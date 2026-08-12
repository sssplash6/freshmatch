// Per-College Report engine version. Stamped into every gap vector, plan,
// report key, and the PDF's Method & Limits page. Bump on ANY change that
// alters report content for the same input — the report cache is keyed on it,
// so bumping cleanly invalidates every cached PDF.
export const ENGINE_VERSION = 'pcr-1.0.0'
