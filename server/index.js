import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import narrateRouter from './routes/narrate.js';
import submissionsRouter from './routes/submissions.js';
import { rateLimit } from './rateLimit.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dir, '../dist');

const app = express();
// Render terminates TLS at its proxy, so the client IP arrives in X-Forwarded-For.
// Trust one proxy hop so req.ip (used by the rate limiter) is the real client.
app.set('trust proxy', 1);
app.use(express.json());

// Per-IP cap on the expensive OpenRouter-backed endpoint. A real user submits the
// quiz a handful of times at most; this throttles abusive loops without a global
// ceiling that could lock out everyone late in the day.
const narrateLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5 });

app.use('/api/narrate', narrateLimiter, narrateRouter);
app.use('/api/submissions', submissionsRouter);

// Serve the built frontend from the same service so relative /api calls resolve.
app.use(express.static(DIST));

// SPA fallback: send index.html for any non-API GET that didn't match a file.
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
