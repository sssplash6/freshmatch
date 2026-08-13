# FreshMatch — Per-College Report Engine

**Technical specification & partner brief (prepared for the Cialfo outreach)**

Version 0.1 · 2026-08-10 · Freshman Academy / FreshMatch

> **Implementation status (2026-08-13, engine `pcr-1.0.0`): phases 0–5 are built and live in this repo.**
> Admissions dataset `server/data/schools-admissions.json` (158 schools, seeded — top-60 QA still owed);
> gap vector `server/report/gapVector.js`; improvement engine `server/report/{rules,simulate,plan}.js`;
> composer with deterministic fallback `server/report/compose.js`; PDF `server/report/pdf.js`;
> API + storage + quotas `server/routes/report.js`; per-college CTA in the results modal.
> One honesty deviation from §7: actions the strength composite does not score (EC depth, rigor,
> strategy) are marked `modeled: false` and carry **no invented Δchance** — the report says so plainly.
> Phase 6 (multi-tenancy, white-label config, metering) remains unbuilt, as scoped below.

> **How to use this document.** Sections 1–3 are the pitch (what it is, why it matters, why we win).
> Sections 4–10 are the engineering spec. Section 11 is the delivery plan. Section 12 maps the spec
> onto email talking points. Anything marked **[VERIFY]** is a number to confirm before it goes into
> an external email.

---

## 1. Executive summary

FreshMatch is a production college-fit engine built for international applicants. A student answers
a seven-step intake (scores, activities, honors, essay, intended majors, dream schools, family
contribution), and in under 30 seconds gets a ranked, financially-filtered list of US universities
with fit scores, admission-chance scores, narratives, match reasons, and concerns.

**What we are adding: the Per-College Report (PCR).**

One PDF per university. Not a summary card — a full counselor-grade dossier that answers three
questions for that one school:

1. **Where do I actually stand?** The student's profile placed side by side with that school's
   admitted-student profile, dimension by dimension.
2. **Why did the engine score me this way?** Every deciding factor, ranked by weight, with the
   underlying evidence shown — not a black box.
3. **What do I do about it?** A prioritized, school-specific improvement plan where each action
   carries a modeled change in admission chance, an effort cost, and a deadline.

That third part is the product. Generic advice ("do more extracurriculars") is worthless. A report
that says *"Your 1450 sits 80 points below Stanford's admitted median of 1530. A retake is the single
highest-yield action available to you: modeled chance moves 22 → 34. Second highest: you have five
activities but no technical artifact — Stanford's strongest programs are CS and Engineering, and your
profile currently reads as breadth without depth in the field you say you want to study"* is a product
a counselor pays for and a student acts on.

**Why this matters to Cialfo.** Cialfo's counselors and students sit exactly where this engine is
strongest: international students applying to US universities, where the two hardest questions are
*"is this realistic?"* and *"is this affordable?"* Our engine answers both deterministically, and the
PCR turns each answer into an action plan a counselor can run a meeting off.

---

## 2. What already exists (in production, not a prototype)

This is the foundation the PCR is built on. It is live, it has served real students, and it is
engineered — not demo-ware.

### 2.1 Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Framer Motion, hand-written CSS (no framework) |
| Backend | Node (ESM), Express 5 |
| Database | SQLite via `better-sqlite3`, WAL mode, on a persistent disk |
| LLM | `anthropic/claude-sonnet-4.6` via OpenRouter, `temperature: 0`, `seed: 42` |
| Email | Resend HTTP API (6-digit verification codes) |
| Hosting | Render web service (paid tier — no cold starts) + 1 GB persistent disk |
| Tests | Vitest + Testing Library |

Single service serves both the API and the built frontend, so all client calls are relative and there
is no CORS surface.

### 2.2 Data assets

| Asset | Size | Contents |
|---|---|---|
| `server/data/schools.json` | **156 schools** | Fiske-style editorial profiles: `character`, `academicEnvironment`, `socialScene`, `notableFeatures`, `studentQuotes`, `admissionsNotes`, `weaknesses`, `bestForStudents`, `strongPrograms`, `stats` (admit rate, yield, 6-yr grad rate, freshman retention), `ratings` (academics / social / quality of life) |
| `server/data/schools-financial.json` | **158 entries** | `aidPolicy`, `noAid` (12 schools), `avgAid` in USD/yr (33 nulls, handled explicitly) |
| `src/data/majors.js` | **76 majors** | Normalized major taxonomy used for program-fit matching |
| `public/logos/` | **155 logos** | Every school in the DB has a mark; monogram fallback otherwise |

The qualitative corpus is the moat. Most tools rank on Common Data Set numbers. We can say *why* a
student will or will not thrive somewhere, because we hold what the place is actually like.

Branch campuses are modeled as first-class institutions with their own aid economics, proxying their
parent's qualitative profile for fit: **NYU Abu Dhabi, NYU Shanghai, Carnegie Mellon Qatar,
Georgetown Qatar, Duke Kunshan**. These matter enormously to international applicants and are usually
missing entirely from US-built tools.

### 2.3 The current pipeline (`POST /api/narrate`)

```
request
  ├─ consent gate            (consentData must be true)
  ├─ email-verification gate (HMAC token bound to the email address)
  ├─ signal gate             hasAssessableSignal() — is there anything real to assess?
  ├─ cache / in-flight dedup (same profile → identical response, one LLM call)
  ├─ strength composite      academicStrength() → 0–100
  ├─ high-profile bypass     isHighProfile() → skip authenticity gates
  ├─ authenticity screen     screenSubmission() — dedicated LLM call, fails OPEN
  ├─ FINANCIAL FILTER        isFinanciallyEligible() — pure JS, before any matching
  ├─ ACADEMIC FILTER         isAcademicallyEligible() — pure JS, tiered by admit rate
  ├─ pool ranking            major-match, then |chance − 55| — spans reach/match/safety
  ├─ chance scores           dreamChanceScore() × dreamFinancialPenalty() — DETERMINISTIC
  ├─ LLM composition         fit scores + narrative + reasons + concerns
  ├─ POST-AI HARD GUARD      drop unknown ids, overwrite names from our DB
  └─ persist + share token
```

Every gate above runs **before** the expensive call. An unfundable or unreachable school never enters
the prompt, so it can never appear in a result.

---

## 3. Why we are different (and better than most)

These are the defensible claims. Each one is a design decision already shipped in code, not an
aspiration.

### 3.1 Deterministic scoring, LLM narration — never the reverse

**The numbers come from pure functions. The model writes prose around numbers it cannot change.**

This is the single most important architectural decision in the product, and it came from a real bug:
when the model chose the score, the same student scored **28 on one run and 60 on the next**. We moved
scoring into `dreamChanceScore()` / `dreamFinancialPenalty()` and pinned the model to
`temperature: 0`, `seed: 42`. The prompt now hands the model the computed chance and instructs it that
its narrative *must be consistent with this number*.

Result: **same input → same output, byte for byte.** A counselor can re-run a student in front of them
and get the identical report. Almost every AI admissions tool on the market fails this test, and
counselors notice immediately.

### 3.2 Money is modeled first, not last

Most tools rank by fit or prestige and let the family discover affordability at the offer stage. We
gate on it before anything else:

- Six EFC brackets map family contribution capacity to a **minimum average aid** the school must
  actually provide, with a 20% tolerance buffer because our aid figures are averages, not guarantees.
- `noAid: true` schools are only surfaced above $80k EFC. Schools with unknown aid are excluded, never
  guessed at.
- Named exceptions are encoded, not hand-waved: need-blind-for-internationals campuses; Duke's Karsh
  Scholarship (need-blind but merit-gated, so it carries a strength floor of 76); NYU Shanghai and
  Duke Kunshan requiring some family contribution capacity; Georgetown and NYU treated as aspirational
  above $60k EFC.
- **Financial reality also discounts admission odds, not just enrollment odds.** Most US schools are
  need-aware for internationals, so needing more aid than a school gives *lowers the chance of
  admission*. Our penalty is continuous in aid coverage — a school that covers 78% of need is barely
  touched; one that covers 20% takes the full hit down to a 0.4 multiplier. Being need-aware is not
  itself a penalty; only an actual shortfall is.

That last mechanic is an admissions truth almost no consumer tool encodes, and it is precisely the
thing international families get burned by.

### 3.3 International-first, not internationally-adapted

- Test inputs: SAT, IELTS, **A-Levels, IB, AP** as optional structured entries.
- **GPA on /4, /5, /10, or /100 scales**, normalized internally to /4.
- Country of application and current school captured and passed into fit reasoning.
- Branch campuses modeled independently (see 2.2) — a student can be filtered out of CMU on cost while
  CMU-Qatar surfaces on its own economics.
- Authenticity screening explicitly instructed to **never penalize non-native English** (see 3.5).

We are built for the applicant Cialfo actually serves.

### 3.4 Hallucination is structurally impossible, not "reduced"

Three independent layers:

1. **Closed candidate set.** The prompt contains only schools that passed the eligibility gates, with
   an explicit "choose ONLY from these" instruction.
2. **Post-model filter.** Any returned school whose `id` is not in the allowed map is silently
   discarded. A hallucinated university physically cannot reach the client.
3. **Authoritative overwrite.** School names are overwritten from our database after the model
   responds, so a misspelling or invented name never renders.

Financial figures get the same treatment: every school in the prompt carries `Avg aid: $X/yr` from our
database as declared ground truth, with an instruction not to raise financial concerns that contradict
it. This was added after the model recommended a no-aid school from its own training knowledge.

### 3.5 Prompt-injection hardened + ESL-safe authenticity screening

**Injection.** All student free text is fenced between `===STUDENT_PROFILE_START===` /
`===STUDENT_PROFILE_END===` markers and declared untrusted in the system prompt. An attempt to
instruct the model, alter scoring, or extract the prompt is classified as bad-faith input and returns
`dataQuality: "insufficient"` rather than being obeyed.

**Junk / troll filtering — two layers, both ESL-safe by construction:**

- *Deterministic:* `hasSubstance()` (character-diversity check), `looksMashed()` (three identical
  letters in a row — essentially never occurs in real spelling, so it is safe against typos and
  non-native English), and a no-content regex catching "I don't have anything", "none", "n/a", "idk".
- *Model:* a dedicated cheap screening call reading the actual written content, with explicit
  instructions that sparse, brief, modest, or imperfect English is **fine**, and that when torn
  between a sincere ESL student and junk, choose genuine. It **fails open** — an API error never
  blocks a real student.
- *High-profile bypass:* genuinely strong, substantive profiles (strength ≥ 50 with a national or
  international honor, or five real activities) skip both gates entirely. This exists because the
  gates occasionally read a real olympiad medalist as "too good to be true." A model cannot flag what
  it never sees.

For an institutional buyer this is the difference between a tool that produces confident nonsense from
a half-filled form and one that says *"there isn't enough here to assess yet — here's what to add."*

### 3.6 Production engineering, not a demo

| Concern | How it's handled |
|---|---|
| LLM timeout | 90s `AbortController`, explicit user-facing message |
| Malformed JSON | Outermost-brace extraction → control-character sanitization → **three-strategy truncation recovery** (error-position, last `},`, last `}`) |
| Duplicate requests | In-flight promise dedup — React StrictMode double-mount costs one LLM call, not two |
| Repeat runs | In-memory response cache keyed on the full profile |
| DB failure | Every write wrapped; a database error can never break a user request |
| No DB configured | Silent no-op — the app runs identically in local dev |
| Cost abuse | Per-IP rate limits: 4 calculations / 30 min; verification 100 / 10 min (deliberately generous for carrier-grade NAT, which is the norm in our market); share reads 120 / 5 min; admin 60 / 5 min |
| Error leakage | Upstream error bodies logged server-side only; clients get a generic message |

### 3.7 Identity, consent, and privacy

- **Email verification before results.** 6-digit code, 10-minute TTL, 5-attempt cap, 30s resend
  cooldown, max 5 codes per address per 30 min. On success, an **HMAC-signed token bound to the email
  address** is issued (30-minute TTL) and re-verified server-side by `/api/narrate` — the results gate
  cannot be bypassed by POSTing the API directly.
- **Explicit consent required** to run the calculation; marketing consent captured separately.
- **API key is server-side only** and never reaches client code.
- **Share links are PII-safe by construction.** `/r/:token` uses an unguessable 12-byte token (not the
  row id, so links can't be enumerated) and the lookup returns *only* the student's first name and the
  results payload — never email, scores, essay, or any other field.
- Stated privacy rule already in force: real applicant records only hit paid / zero-data-retention
  endpoints.

### 3.8 A growth loop is already wired in

`/r/:token` share pages are server-rendered with injected Open Graph and Twitter meta tags, so a
student sharing their results produces a personalized unfurl on WhatsApp / Telegram / Instagram. **[VERIFY]**
Early distribution: ~300 users in the first two days in Uzbekistan — confirm the current figure
before quoting it.

---

## 4. Per-College Report — product definition

### 4.1 What it is

One PDF per (student × college) pair, generated on demand or in batch. Target length 6–9 pages.
Deterministic: the same student and the same college always produce a byte-identical PDF for a given
engine version.

### 4.2 Report anatomy

| # | Section | Source |
|---|---|---|
| 1 | **Cover** — student name, university mark, fit score, admission chance, one-line verdict band | Existing scores + `schoolLogos` |
| 2 | **Standing** — student profile vs admitted-student profile, side by side, dimension by dimension, with percentile placement | Gap Vector (§5) + new admissions dataset (§6) |
| 3 | **Why this school fits you** | `character`, `academicEnvironment`, `strongPrograms`, `bestForStudents`, `notableFeatures`, `studentQuotes` |
| 4 | **Deciding factors** — every factor that moved the score, ranked by weight, each showing the evidence behind it | Gap Vector, rendered |
| 5 | **Working against you** — honest concerns, including the school's own documented weaknesses | `weaknesses`, `concerns`, gap shortfalls |
| 6 | **Your path in** — prioritized improvement plan; each action carries Δchance, effort, and deadline | Improvement Engine (§7) |
| 7 | **Scenarios** — Minimum viable / Realistic / Maximum, each with the resulting modeled chance | Counterfactual simulator (§7.3) |
| 8 | **The money** — aid math, estimated net cost, named scholarship targets, comparable-fit alternatives if there's a shortfall | Financial model (§3.2) |
| 9 | **Application strategy** — ED/EA/RD recommendation, essay angles derived from *this student's actual activities*, what to foreground | LLM composer over locked inputs |
| 10 | **Timeline** — dated checklist anchored to the application cycle and the student's grade | Rule catalogue deadlines |
| 11 | **Method & limits** — what we model, what we don't, where the data comes from | Static + engine version stamp |

Section 11 is not filler. An institutional buyer will have counselors stress-test this report; stating
our limits plainly is what makes the other ten pages credible.

### 4.3 Worked example (illustrative)

> **Student:** 1450 SAT · 3.85/4.0 · IELTS 8.0 · 6 activities · 1 national olympiad (silver) ·
> intended major CS · EFC bracket $15–25k
> **School:** Stanford University

**Standing**

| Dimension | You | Admitted middle 50% | Status |
|---|---|---|---|
| SAT | 1450 | 1500–1570 | ▼ 50 below P25 |
| GPA (norm. /4) | 3.85 | 3.95+ | ▼ slight shortfall |
| Honor ceiling | National | National / International | ● at par |
| Activity depth | 6 listed, 1 with leadership | Deep, artifact-bearing | ▼ breadth without depth |
| Program alignment | CS | CS is a flagship program | ▲ strong |
| Financial | $15–25k bracket | Avg aid $X/yr, need-blind for internationals | ▲ fundable |

**Path in (top 3 of 7)**

1. **Retake the SAT, target ≥ 1530.** You are 50 points below the 25th percentile of admitted
   students — the band where testing becomes a liability rather than a neutral. Effort: 6–8 weeks
   structured prep. **Modeled chance: 22 → 31.**
2. **Ship one technical artifact with a public URL.** Six activities, none of them producing a
   technical output, in a field where Stanford's strongest programs are CS and Engineering. Your
   profile currently reads as breadth without depth in the exact area you're claiming. Effort: 8–12
   weeks. **Modeled chance: 31 → 38.**
3. **Convert the national silver into an international attempt.** Your honor ceiling is at par for the
   admitted pool but not above it, and at a 4% admit rate "at par" is not a differentiator.
   **Modeled chance: 38 → 44.**

> Numbers illustrate the mechanic. Actual movements come from re-running the scoring function on the
> counterfactual profile (§7.3).

---

## 5. The Gap Vector — core new abstraction

For each (student, college) pair the engine computes a structured, **fully deterministic** gap vector.
No model involvement. This object is the report's spine, the improvement engine's input, and — for
partners who want to render their own UI — a clean JSON deliverable on its own.

```js
// server/report/gapVector.js
{
  collegeId: 'stanford',
  engineVersion: 'pcr-1.0.0',
  strength: 71,                    // academicStrength() composite
  chance: 22,                      // dreamChanceScore() × dreamFinancialPenalty()
  fitScore: 84,                    // model-judged, band-calibrated
  dimensions: [
    {
      key: 'testing',
      label: 'Standardized testing',
      status: 'shortfall',         // surplus | at-par | shortfall | critical
      studentValue: 1450,
      benchmark: { p25: 1500, p50: 1530, p75: 1570 },
      delta: -50,                  // vs p25
      percentile: 14,              // student's placement in the admitted distribution
      weight: 0.24,                // school-specific dimension weight
      evidence: 'SAT 1450 vs admitted P25 of 1500',
      leverage: 'high'             // how movable this dimension is
    },
    // ... rigor, gpa, honors, ecDepth, ecBreadth, programAlignment,
    //     characterFit, financialFeasibility, institutionalGates
  ],
  gates: {                          // hard institutional rules and their state
    satMinimum:      { applies: false },
    strengthFloor:   { applies: false },
    efcFloor:        { applies: false },
    needBlind:       { applies: false },
    financialFilter: { passed: true, coverage: 1.0 }
  }
}
```

### 5.1 Dimensions

| Key | Computed from | Benchmark |
|---|---|---|
| `testing` | SAT (400–1600 sanity-bounded) | New admissions dataset: P25/P50/P75 |
| `gpa` | GPA normalized to /4 from any scale | Admitted average GPA |
| `rigor` | Count and level of A-Level / IB / AP entries | Expectation derived from `ratings.academics` and admit-rate tier |
| `honors` | Honor levels (intl 15 / natl 10 / regional 5 / school 2, capped at 30) | Admit-rate tier expectation |
| `ecDepth` | Leadership, duration, and impact markers detected in activity text | Tier expectation |
| `ecBreadth` | Count of real activities passing `isRealEc()` | Tier expectation |
| `programAlignment` | `majorMatches()` — intended majors vs `strongPrograms` | Binary + strength of match |
| `characterFit` | Student archetype vs the school's `character` array | Model-assisted, band-locked |
| `financialFeasibility` | EFC bracket vs `avgAid`, aid coverage ratio | `EFC_BRACKETS` + `BUFFER` |
| `institutionalGates` | `SAT_MINIMUMS`, `STRENGTH_FLOORS`, `EFC_MIN`, `EFC_FLOOR`, `NEED_BLIND_IDS` | Hard pass/fail |

### 5.2 Dimension weighting

Weights are school-specific and derived, not hand-tuned per school:

- **Admit-rate tier** sets the base profile. At ≤5% admit, honors and EC depth dominate testing
  (everyone has the scores). At 20–50%, testing and GPA carry more.
- **`ratings.academics = 5`** raises the rigor weight.
- **`strongPrograms` overlap with intended major** raises `programAlignment` weight — if a student
  names a major, the school's strength in it becomes a primary factor.
- **Financial coverage < 1.0** raises `financialFeasibility` weight sharply, because for a need-aware
  school an aid shortfall is an admissions factor.

Weights are normalized to sum to 1.0 and stamped into the report so the reasoning is auditable.

---

## 6. New data requirement: admitted-student profiles

**This is the largest new data lift and should be stated honestly in any partner conversation.**

Our current corpus has admit rate, yield, retention, graduation rate, ratings, and rich qualitative
text — but **not** admitted-student score distributions. The PCR needs them to say "you are 50 points
below the 25th percentile" rather than "your score is a bit low."

New file: `server/data/schools-admissions.json`, one entry per school id.

```js
{
  "id": "stanford",
  "sat":  { "p25": 1500, "p50": 1530, "p75": 1570, "submitRate": 0.68 },
  "act":  { "p25": 34, "p50": 35, "p75": 36 },
  "gpa":  { "mean": 3.95, "scale": 4.0 },
  "testPolicy": "required" | "optional" | "blind",
  "decisionPlans": {
    "ed":  { "offered": true, "admitRate": 0.13, "deadline": "11-01" },
    "ea":  { "offered": false },
    "rd":  { "deadline": "01-05" }
  },
  "internationalAdmitRate": 0.03,     // null when unpublished
  "demonstratedInterest": false,
  "sources": ["CDS 2024-25", "IPEDS 2024"],
  "asOf": "2026-08"
}
```

**Sourcing:** Common Data Set filings (primary), IPEDS (fallback), institutional admissions pages.
Every field carries a source and an `asOf` stamp, and any field we cannot source is `null` — the gap
engine degrades to a qualitative statement rather than inventing a benchmark. This is the same
discipline already applied to `avgAid: null` (33 schools currently excluded rather than guessed).

Estimated effort: 1–2 weeks including manual QA on the top 60 schools.

---

## 7. The Improvement Engine

The differentiator. Design principle is the same one that made the scoring trustworthy:
**rules first, model second.**

### 7.1 Architecture

```
Gap Vector
    ↓
Rule catalogue        deterministic pattern → prescription match
    ↓
Counterfactual sim    re-run scoring on the improved profile → Δchance
    ↓
ROI ranking           Δchance ÷ effort, constrained by time-to-deadline
    ↓
LLM composer          writes the *prose* for each locked prescription
    ↓
Schema validation     drop anything malformed; never ship an unvalidated action
```

The model never invents an action, never assigns a Δchance, and never reorders the plan. It writes the
sentences around a fixed, machine-generated skeleton. Determinism holds end to end.

### 7.2 Rule catalogue (initial set, ~30 rules)

Each rule is a pure predicate over the Gap Vector emitting a structured prescription.

| Rule | Fires when | Prescription shape |
|---|---|---|
| `SAT_BELOW_P25` | testing delta < 0 vs P25 | Retake targeting P50; quantified point gap; realistic prep window |
| `SAT_P25_TO_P50` | between P25 and P50 | Optional retake; **or** apply test-optional if policy allows and GPA percentile > test percentile |
| `TEST_OPTIONAL_ARBITRAGE` | policy = optional AND test percentile ≪ GPA percentile | Withhold the score; strategy explained |
| `GPA_SHORTFALL` | normalized GPA below admitted mean | Term-by-term recovery target; which courses matter most here |
| `RIGOR_GAP` | rigor below tier expectation | Named course additions weighted to `strongPrograms` |
| `HONOR_CEILING` | honor ceiling ≤ tier expectation at ≤10% admit | Concrete pathways to the next level, filtered by the student's country and curriculum |
| `EC_BREADTH_WITHOUT_DEPTH` | breadth at/above par, depth below | Consolidate — name which two of *their* activities to deepen |
| `PROGRAM_MISALIGNMENT` | intended major not in `strongPrograms` | Either reposition the application narrative or reconsider the school; both stated plainly |
| `TECHNICAL_DEPTH_GAP` | `strongPrograms` are technical, activities carry no technical artifact | Ship something with a public URL; target a specific competition tier |
| `NARRATIVE_INCOHERENCE` | activities/honors don't converge on the stated major | Choose a through-line; which of their existing items support it |
| `AID_SHORTFALL` | financial coverage < 1.0 | Named scholarship targets; comparable-fit full-need alternatives |
| `NEED_BLIND_OPPORTUNITY` | school is need-blind for internationals and student is high-need | Prioritize — this school's aid policy is a structural advantage for you |
| `ED_LEVERAGE` | chance 35–60 AND ED offered AND ED rate materially above RD | Quantified ED value, with the binding-commitment affordability caveat stated first |
| `DEMONSTRATED_INTEREST` | school tracks it | Specific, dated interest actions |
| `GATE_BLOCKED` | a hard gate fails (e.g. Colby's 1540 SAT minimum) | State the gate explicitly and what clears it |
| `CEILING_REACHED` | no meaningful gap remains | Say so. "Your profile is competitive; the remaining variance is essay and fit." |

`CEILING_REACHED` matters as much as any other rule. A report that manufactures work for an already-
strong student destroys the credibility of the ones that don't.

### 7.3 Counterfactual simulation — the headline mechanic

Because `academicStrength()`, `dreamChanceScore()`, and `dreamFinancialPenalty()` are **pure
functions**, we can cheaply answer: *what happens to this student's odds if they do X?*

```js
function simulate(profile, school, mutations) {
  const after = applyMutations(profile, mutations)   // e.g. { sat: 1530 }
  const strength = academicStrength(after.testScores, after.honors, after.extracurriculars)
  const chance = Math.max(5, Math.round(
    dreamChanceScore(strength, school) * dreamFinancialPenalty(after.efc, financial[school.id])
  ))
  return { chance, delta: chance - baseline.chance }
}
```

Every prescription is scored this way. Three composite scenarios are computed for §7 of the report:

- **Minimum viable** — the single highest-ROI action
- **Realistic** — every action achievable before the applicable deadline given the student's grade
- **Maximum** — the full plan executed

Cost: microseconds, zero tokens, perfectly reproducible. This is the section that turns a report from
*assessment* into *plan*, and it exists purely because we kept scoring out of the model.

### 7.4 ROI ranking

Each prescription carries `effortWeeks`, `effortIntensity`, and a `deadlineAnchor` (relative to the
application cycle). Ranking is a greedy pass over `Δchance / effortCost`, filtered by feasibility:

- Actions that cannot complete before their deadline anchor are demoted to a **"next cycle"** block
  (relevant for grade-10 and grade-11 students, whose grade we already collect).
- Two rules targeting the same dimension are collapsed to the higher-yield one — no plan should
  contain "retake the SAT" twice.
- The plan is capped at **7 actions**. A 20-item list is not a plan.

---

## 8. PDF generation

### 8.1 Options considered

| Approach | Fidelity | Infra cost | Determinism | Verdict |
|---|---|---|---|---|
| Headless Chromium (Puppeteer / Playwright) | Highest — full CSS | ~300 MB dependency, heavy RAM per render | Good with pinned version | Fallback if design demands it |
| **`@react-pdf/renderer` (server-side)** | High — flexbox layout, embedded fonts | Pure JS, no browser | Excellent | **Recommended** |
| `pdfkit` | Total control, most work | Minimal | Excellent | Overkill |
| Client `window.print()` | Browser-dependent | Zero | Poor | No batch generation — disqualifying for the counselor use case |

**Recommendation: `@react-pdf/renderer`, server-side.** It matches the team's existing React skill set,
needs no headless browser on a memory-constrained Render instance, streams to the response, and
produces reproducible output. Batch generation for counselors *requires* server-side rendering, which
rules out the client-print path immediately.

### 8.2 Template

A shared `<ReportDocument>` component tree with the FreshMatch brand system (navy / orange / Georgia)
and an accepted-props theme object, so white-labeling for a partner is a props change, not a fork:

```js
<ReportDocument
  theme={{ logo, primary, accent, fontFamily, footerText }}
  gapVector={…}
  plan={…}
  prose={…}
/>
```

---

## 9. API surface

### 9.1 Endpoints

```
POST /api/report
  body: { submissionId | profile, collegeId, verifyToken }
  →    { reportId, pdfUrl, gapVector, plan }        # JSON is a first-class deliverable

GET  /api/report/:reportId.pdf
  →    application/pdf (streamed, ETag'd, immutable)

POST /api/reports/batch
  body: { submissionId | profile, collegeIds: [...], verifyToken }
  →    { reports: [{ collegeId, reportId, pdfUrl, status }] }
       # fan-out with concurrency 4; partial success is reported per college, never fatal

GET  /api/report/:reportId.json
  →    the Gap Vector + plan, for partners rendering their own UI
```

### 9.2 Idempotency & caching

```
reportKey = sha256(profileHash + collegeId + ENGINE_VERSION)
```

The key is the filename. A cache hit is a disk read — zero tokens, zero latency. Bumping
`ENGINE_VERSION` invalidates everything cleanly and is stamped on the report's method page, so a
counselor can always tell which engine produced a given PDF.

### 9.3 Storage

PDFs on the existing Render persistent disk at `/var/data/reports/{reportKey}.pdf`. New table:

```sql
CREATE TABLE reports (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  submission_id     INTEGER REFERENCES submissions(id),
  college_id        TEXT NOT NULL,
  engine_version    TEXT NOT NULL,
  profile_hash      TEXT NOT NULL,
  chance_before     INTEGER,
  chance_ceiling    INTEGER,     -- Maximum scenario
  improvement_count INTEGER,
  pdf_path          TEXT,
  UNIQUE(profile_hash, college_id, engine_version)
);
```

Retention policy and a disk-usage ceiling with LRU eviction are required before launch — a 1 GB disk
holds roughly 2,000–4,000 reports at an expected 250–500 KB each.

### 9.4 Rate limiting and quotas

Report generation is more expensive than a match run (one LLM call per college rather than one per
student). Proposed: **12 reports / 30 min per IP** for consumer use, and **per-tenant metered quotas**
for partners, replacing the IP limiter with an API-key limiter on the partner path.

---

## 10. Cost, latency, and scale

Deliberately expressed in tokens rather than currency — multiply by your current OpenRouter rate card,
since the model and its pricing are both configurable via `OPENROUTER_MODEL`.

| Operation | LLM calls | Approx. input tokens | Approx. output tokens | Wall clock |
|---|---|---|---|---|
| Existing match run | 1 (+1 screen) | 6–9k | 3–5k | 20–30s |
| Single per-college report | 1 | 3–5k | 1.5–2.5k | 12–20s |
| Batch of 12 colleges | 12 (concurrency 4) | 40–60k | 20–30k | 45–70s |
| Cached report re-fetch | **0** | 0 | 0 | <50ms |

The deterministic layers — gap vector, rule matching, counterfactual simulation, ROI ranking — cost
**zero tokens**. Only the prose composition touches the model. That ratio is what makes per-college
reports economically viable at counselor volume, and it is a direct consequence of the
scoring-outside-the-model architecture.

**Scale note.** The current single-instance-with-disk deployment is correct for today's volume but
pins us to one instance. Partner-scale volume means moving the DB to Postgres and report storage to
object storage (S3/R2), at which point the service scales horizontally without further change. That is
a known, bounded migration — flagged here so it is not a surprise in a commercial conversation.

---

## 11. Cialfo integration paths

Four options, in increasing order of integration depth. All four are supported by the same engine; the
differences are packaging.

**A. API / OEM.** Cialfo posts a student profile from their own system and receives `{ pdfUrl,
gapVector, plan }`. Auth by API key + HMAC request signing. Fastest path to value; no UI work on
either side.

**B. White-label embed.** The FreshMatch intake and report, themed with Cialfo's brand tokens and
served under their domain. The report template already accepts a theme object (§8.2).

**C. Counselor batch.** Roster upload (CSV or API), producing a per-student × per-college report
bundle plus a counselor-facing summary: which students are under-tested, which lists are
financially unrealistic, which students are already at ceiling. **This is the highest-value
enterprise surface** — it turns an individual student tool into a caseload management tool.

**D. Data-only.** Cialfo consumes the Gap Vector and improvement plan as JSON and renders it in their
own product. No PDF, no UI, lowest integration friction, and it makes the engine a component of their
platform rather than an adjacent tool.

### 11.1 What partner-readiness requires (not yet built)

State these plainly — they are ordinary work, and naming them builds more credibility than omitting
them:

- Tenant model: `tenants` table, API keys, per-tenant branding, quotas, usage metering
- Postgres migration + object storage for horizontal scale (§10)
- **Data residency** — Cialfo is Singapore-headquartered; confirm whether student PII must remain in
  a specific region
- **Zero-data-retention LLM endpoints** for all partner traffic (already our stated internal rule for
  real applicant records)
- Field-level encryption for stored PII (AES-256-GCM) — planned, plan already drafted, not yet shipped
- Audit logging, DPA, and a security questionnaire response pack
- SLA definition: availability target, latency target, support response

---

## 12. Delivery plan

| Phase | Scope | Estimate |
|---|---|---|
| 0 | **Admissions dataset** — score distributions, test policy, decision plans, intl rates for 156 schools, with sources and `asOf` stamps | 1–2 weeks |
| 1 | **Gap Vector engine** — pure functions, dimension weighting, full unit test coverage | 3–5 days |
| 2 | **Improvement engine** — rule catalogue, counterfactual simulator, ROI ranking | 5–7 days |
| 3 | **LLM composer** — prose generation over locked skeletons, schema validation, injection fencing | 3–4 days |
| 4 | **PDF renderer** — brand template, theming, layout QA | 4–6 days |
| 5 | **API + storage** — endpoints, idempotent caching, batch fan-out, admin visibility | 4 days |
| 6 | **Partner readiness** — multi-tenancy, white-label, quotas, metering | 1–2 weeks |

**~3 weeks to a demo-quality single-college report** (phases 0–4 on a reduced school set — 20 schools
is enough to demo convincingly). **~6–8 weeks to a partner-grade v1** including multi-tenancy.

Phase 0 is the critical path and can run fully in parallel with phases 1–4, since the gap engine can
be developed against a fixture dataset.

---

## 13. Talking points for the outreach email

Suggested argument arc, with the supporting fact for each claim.

**1. Lead with the problem Cialfo's counselors actually have.**
A counselor with 200 students cannot write a school-specific, evidence-backed action plan for each
student × each college on their list. That's the labor the PCR automates — and it's the labor that
determines outcomes.

**2. Establish that this is production software, not a concept.**
Live product, real users, 156 editorial school profiles, 158-school financial dataset, email
verification, consent capture, rate limiting, share-page growth loop, test suite.

**3. Lead the technical differentiation with determinism.**
"The model never picks a number." Same input → identical output. We can demo this live: run the same
student twice, byte-identical result. Almost no AI admissions tool survives that demo. We know,
because ours didn't until we fixed it — a student scored 28 and then 60 on consecutive runs, and we
rebuilt scoring as pure functions in response.

**4. Then the financial modeling — this is the one that lands with an international-focused buyer.**
We filter on affordability *before* fit, and we discount admission odds by aid shortfall because most
US schools are need-aware for internationals. Encode: EFC brackets, 20% buffer, continuous coverage
penalty, need-blind exceptions, named-scholarship gates, branch campuses as first-class institutions.

**5. Then the counterfactual simulator — this is the feature nobody else has.**
Because scoring is a pure function, we can tell a student *"raise your SAT to 1530 and your modeled
chance at this school moves 22 → 31."* Not advice — a simulation. It costs zero tokens and is exactly
reproducible.

**6. Then trust and safety, framed as institutional risk reduction.**
Hallucinated schools are structurally impossible (closed candidate set + post-model id filter +
authoritative name overwrite). Prompt injection is fenced. Junk submissions are refused rather than
answered — with an ESL-safe screen that explicitly never penalizes imperfect English or modest
profiles, and never flags a strong student as "too good to be true."

**7. Close on integration optionality.**
Four paths (API, white-label, counselor batch, data-only). Batch is the enterprise story: a caseload
view showing which students are under-tested, which lists are financially unrealistic, and which are
already at ceiling.

**8. Be explicit about what's built vs. what we'd build for them.**
Built: the engine, the data, the scoring, the safety layers, the delivery infrastructure. To build:
the admissions score dataset (1–2 weeks), the report itself (3–4 weeks), multi-tenancy (1–2 weeks).
Naming the gap is more persuasive than implying there isn't one — and 3 weeks to a working demo is a
strong number to put in writing.

### Numbers to confirm before sending **[VERIFY]**

- Current total user count and the Uzbekistan launch figure (~300 in 2 days)
- Whether any admission outcomes have been tracked yet
- Freshman Academy's own placement record (85%+ admit rate for the Full Support cohort, per current
  site copy) — this is a strong credibility anchor and should be quoted exactly as the site states it
- Current OpenRouter rate card, if any per-report cost figure is quoted

### What NOT to claim

- No validated predictive accuracy — we have not yet tracked modeled chance against real outcomes.
  Call it a *modeled* chance, consistently. Offering to run a validation study on Cialfo's historical
  outcome data is a genuinely attractive proposal and is far stronger than an unbacked accuracy claim.
- Not 156 schools with full admitted-score data yet — that's phase 0.
- No SOC 2, no DPA, no signed data-residency posture yet. Present these as scoped work, not as done.

---

## Appendix A — Key functions referenced

All in `server/routes/narrate.js` unless noted.

| Function | Purpose |
|---|---|
| `academicStrength(testScores, honors, ecs)` | 0–100 composite. SAT 0–40, GPA 0–20, honors 0–30 (intl 15 / natl 10 / regional 5 / school 2), ECs 0–10 |
| `dreamChanceScore(strength, school)` | Deterministic admission odds: `strength × 0.75 + admitRate × 1.2 − 10`, clamped 5–92; admit rate clamped 2–60 |
| `dreamFinancialPenalty(efc, fin)` | Continuous aid-coverage multiplier, 0.4–1.0; continuous at the 0.8-coverage eligibility boundary |
| `isFinanciallyEligible(efc, school)` | EFC bracket vs `avgAid` with 20% buffer; need-blind, EFC-minimum, EFC-floor, and no-aid exceptions |
| `isAcademicallyEligible(strength, school, testScores)` | Tiered strength gate by admit rate (≤5% → 76, ≤10% → 58, ≤15% → 44, ≤20% → 32), plus per-school SAT minimums and strength floors |
| `hasAssessableSignal(profile)` | Is there any real anchor at all? Bails before spending an LLM call if not |
| `isHighProfile(strength, honors, ecs)` | Deterministic bypass of the authenticity gates for genuinely strong profiles |
| `screenSubmission(profile)` | Dedicated ESL-safe authenticity screen; fails open |
| `majorMatches(majors, school)` | Intended major vs `strongPrograms` overlap |
| `compressSchool(school)` | Token-efficient school representation for the prompt |
| `recommendProgram(testScores, honors, ecs)` | Which Freshman Academy program to surface in the CTA |
| `verifyToken(token, email)` (`server/verify.js`) | HMAC verification of the email-verified token |
| `getSubmissionByToken(token)` (`server/db.js`) | PII-safe share-page lookup — first name and results only |

## Appendix B — Environment configuration

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Server-side only, never in client code |
| `OPENROUTER_MODEL` | Currently `anthropic/claude-sonnet-4.6` |
| `OPENROUTER_SCREEN_MODEL` | Optional cheaper model for the authenticity screen |
| `DATABASE_PATH` | SQLite file on the persistent disk; unset = silent no-op |
| `ADMIN_TOKEN` | Guards `GET /api/submissions`; endpoint disabled when unset |
| `RESEND_API_KEY` / `VERIFY_FROM` | Verification email delivery; unset = codes logged locally |
| `VERIFY_SECRET` | Keeps verified-email tokens valid across restarts |
