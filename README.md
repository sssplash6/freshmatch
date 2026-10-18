# FreshMatch

A college-fit engine for international applicants, built for Freshman Academy. A
high school student in Uzbekistan or the CIS answers a short intake (scores,
activities, honors, essay, intended majors, dream schools, what their family can
pay) and gets back a ranked, financially filtered list of US universities, each
with an admission-chance score, a fit score, and a frank explanation. Students
can also download a per-college PDF report with a school-specific improvement plan.

Who it is for and how it should feel: `PRODUCT.md`.

## How the AI is used

The rule the whole product is built around: **code computes the numbers, the
model only writes the words around them.** An early version let the model pick
the score, and the same student scored 28 on one run and 60 on the next. Scoring
moved into pure functions, the model runs at `temperature: 0` with a fixed seed,
and the prompt hands it the computed chance and tells it the narrative must agree
with that number. Same input, same output.

Around that:

- **Money first.** Schools the family cannot afford are filtered out in plain
  JavaScript before any model call, using each school's average aid and a
  six-bracket family-contribution model. Schools with unknown aid are excluded,
  never guessed. Needing more aid than a school gives also lowers the admission
  chance, because most US schools are need-aware for internationals.
- **No invented universities.** The prompt contains only schools that passed the
  gates. Any id the model returns that is not in that set is dropped, and every
  school name is overwritten from the database afterwards.
- **Untrusted input stays untrusted.** Student free text is fenced and declared
  untrusted in the system prompt; attempts to instruct the model come back as
  "insufficient data" instead of being obeyed.
- **Authenticity screen.** A separate model call rejects gibberish and fabricated
  profiles. It fails open, skips strong profiles entirely, and is told never to
  penalise non-native English.
- **Per-College Report.** For one school, a deterministic "gap vector" places the
  student against that school's admitted-student profile, a rule catalogue and
  counterfactual simulation rank what to improve, and the model writes the prose.
  If the model call fails, the report still generates from template prose.
  Actions the scoring cannot measure are marked as unmodelled rather than given
  an invented effect.

The full pipeline, design decisions and partner pitch are in
`docs/per-college-report-spec.md`.

## Data

| File | Contents |
|---|---|
| `server/data/schools.json` | 156 qualitative school profiles (character, academics, social scene, strong programs, weaknesses), extracted from a college guide by `scripts/extract-fiske.mjs` |
| `server/data/schools-financial.json` | Aid policy and average aid for 158 schools |
| `server/data/schools-admissions.json` | Admitted-student benchmarks for 158 schools, used by the reports |
| `src/data/majors.js` | Normalised major taxonomy |

Branch campuses (NYU Abu Dhabi, NYU Shanghai, CMU Qatar, Georgetown Qatar, Duke
Kunshan) are modelled as separate schools with their own aid.

## Run it

```bash
npm install
cp .env.example .env    # add OPENROUTER_API_KEY; the rest is optional locally
npm run dev:server      # API on http://localhost:3001
npm run dev             # app on http://localhost:5173, proxies /api to the server
npm test                # Vitest, frontend and server
```

Without `RESEND_API_KEY` the email verification code is printed to the server
console. Without `DATABASE_PATH` nothing is stored. Every variable is explained
in `.env.example`.

Production is one Render web service (`render.yaml`): `npm run build`, then
`npm start` serves the API and the built frontend together, with SQLite and the
report cache on a persistent disk.

## Where things are

- `src/phases/`: the screens in order (landing, intake, email verification, results).
- `src/admin/`: the `/admin` dashboard over stored submissions (needs `ADMIN_TOKEN`).
- `server/scoring.js`, `server/data.js`: the deterministic scoring and eligibility core.
- `server/routes/narrate.js`: the main pipeline, gates through to the model call.
- `server/report/`: the Per-College Report engine (gap vector, rules, simulation, composer, PDF).
- `server/verify.js`, `server/rateLimit.js`: email codes and per-route limits.
