import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import narrateRouter from './routes/narrate.js';
import submissionsRouter from './routes/submissions.js';
import shareRouter from './routes/share.js';
import { getSubmissionByToken } from './db.js';
import { injectShareMeta, shareCopy } from './shareMeta.js';
import { rateLimit } from './rateLimit.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dir, '../dist');

// Built index.html, read once (the process restarts on every redeploy, so a new
// build is always picked up). Used as the template for personalized share pages.
let indexHtml = null;
function baseIndexHtml() {
  if (indexHtml === null) {
    try { indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8'); }
    catch { indexHtml = ''; }
  }
  return indexHtml;
}

const app = express();
// Render terminates TLS at its proxy, so the client IP arrives in X-Forwarded-For.
// Trust one proxy hop so req.ip (used by the rate limiter) is the real client.
app.set('trust proxy', 1);
app.use(express.json());

// Per-IP cap on the expensive OpenRouter-backed endpoint. A real user submits the
// quiz a handful of times at most; this throttles abusive loops without a global
// ceiling that could lock out everyone late in the day.
const narrateLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5 });

// Per-IP cap on the admin endpoint. The ADMIN_TOKEN is the only barrier to the
// stored PII, so throttle to make online brute-forcing of the token infeasible
// while leaving plenty of headroom for a real admin (refreshing, opening detail
// modals, exporting). 60 requests / 5 min per IP is far below any brute-force rate.
const adminLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 60 });

// Public shared-results reads are cheap (single indexed lookup) but uncapped
// reads invite enumeration/scraping. 120 / 5 min per IP is ample for a person
// opening a few shared links while making bulk token-guessing pointless.
const shareLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 120 });

app.use('/api/narrate', narrateLimiter, narrateRouter);
app.use('/api/submissions', adminLimiter, submissionsRouter);
app.use('/api/r', shareLimiter, shareRouter);

// Personalized share page. Crawlers (no JS) read these injected OG/Twitter tags
// for the link unfurl; real visitors get the same HTML and the SPA renders the
// full interactive results. Unknown tokens / no DB fall back to the generic page
// (the SPA then shows its "link not available" state). Registered before the
// static + SPA-fallback handlers so it wins for /r/:token.
app.get('/r/:token', (req, res, next) => {
  const html = baseIndexHtml();
  if (!html) return next(); // no build yet (e.g. dev) → let the fallback handle it

  const { token } = req.params;
  let shared = null;
  if (/^[A-Za-z0-9_-]{8,64}$/.test(token)) {
    try { shared = getSubmissionByToken(token); } catch { shared = null; }
  }
  if (!shared) return res.type('html').send(html); // generic page

  const origin = `${req.protocol}://${req.get('host')}`;
  const { title, description } = shareCopy(shared.name, shared.output);
  const personalized = injectShareMeta(html, {
    title,
    description,
    url: `${origin}/r/${token}`,
    image: `${origin}/brand-shield.png`,
  });
  res.type('html').send(personalized);
});

// Serve the built frontend from the same service so relative /api calls resolve.
app.use(express.static(DIST));

// SPA fallback: send index.html for any non-API GET that didn't match a file.
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
