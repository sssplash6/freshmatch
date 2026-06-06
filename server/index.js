import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json());

// Routes go here
// import narrateRouter from './routes/narrate.js';
// app.use('/api/narrate', narrateRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
