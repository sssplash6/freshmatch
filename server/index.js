import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import narrateRouter from './routes/narrate.js';
import submissionsRouter from './routes/submissions.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dir, '../dist');

const app = express();
app.use(express.json());

app.use('/api/narrate', narrateRouter);
app.use('/api/submissions', submissionsRouter);

// Serve the built frontend from the same service so relative /api calls resolve.
app.use(express.static(DIST));

// SPA fallback: send index.html for any non-API GET that didn't match a file.
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
