# FreshMatch

![commits](https://img.shields.io/github/commit-activity/t/sssplash6/calc) · live at [freshmatch.net](https://freshmatch.net)

**The problem.** Students in Uzbekistan and the CIS come to Freshman Academy with two questions before anything else: is a US university realistic for me, and can my family afford it? An honest answer took a counselor's meeting, and generic chance calculators ignore what the family can pay.

**The idea.** Let code compute the numbers and let an AI model only write the words around them. An early version let the model pick the score, and the same student got 28 on one run and 60 on the next. Scoring moved into plain functions; now the same input always gives the same output.

**What it does now.**

- A seven-step intake (scores, activities, honors, essay, majors, dream schools, what the family can pay) returns a ranked list of US universities, each with an admission chance, a fit score and a frank explanation.
- Schools the family cannot afford are filtered out in code before any model call. Schools with unknown aid are excluded, never guessed.
- The model can only name schools that passed those filters, student text is treated as untrusted, and a separate check rejects fabricated profiles.
- A Per-College Report: one PDF per school that places the student against its admitted students and ranks what to improve, with each step's modeled effect on the chance.
- 816 assessments by 555 students from 27 countries, and 374 Per-College Reports (as of 19 October 2026).

**Stack:** React 19 + Vite, Express 5, SQLite (better-sqlite3), OpenRouter for the model calls, Resend for email codes. One Render web service. School data: 156 qualitative profiles, aid and admissions data for 158 schools.

## Run it

```bash
npm install
cp .env.example .env    # add OPENROUTER_API_KEY; the rest is optional locally
npm run dev:server      # API on http://localhost:3001
npm run dev             # app on http://localhost:5173
npm test
```

Without `RESEND_API_KEY` the email code prints to the server console. The full scoring and report design: [`docs/per-college-report-spec.md`](docs/per-college-report-spec.md).
