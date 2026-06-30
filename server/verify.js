// Email verification — 6-digit codes + signed "verified email" tokens.
//
// Two pieces:
// 1. A short-lived 6-digit code, emailed to the address being verified. Held in
//    memory (single Node process on Render) with an expiry + attempt cap.
// 2. On a correct code, an HMAC-signed token bound to the email. The client
//    passes it to /api/narrate, which re-verifies it server-side — so the
//    results gate can't be bypassed by POSTing narrate directly.
//
// Email is sent via Resend's HTTP API. When RESEND_API_KEY is unset (local dev)
// the code is logged to the server console instead, so the whole flow still
// works end-to-end without an email account — mirroring how db.js no-ops
// without DATABASE_PATH.
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto'

const CODE_TTL_MS = 10 * 60 * 1000      // a code is valid for 10 minutes
const TOKEN_TTL_MS = 30 * 60 * 1000     // a verified-email token is valid for 30 minutes
const MAX_ATTEMPTS = 5                  // wrong guesses before a code is burned
const RESEND_COOLDOWN_MS = 30 * 1000    // minimum gap between sends to one email
const MAX_SENDS_PER_WINDOW = 5          // sends per email per window (anti email-bombing)
const SEND_WINDOW_MS = 30 * 60 * 1000

const RESEND_API_URL = 'https://api.resend.com/emails'
const SEND_TIMEOUT_MS = 15_000

// Secret for signing verified-email tokens. Set VERIFY_SECRET in production so
// tokens survive a process restart; otherwise a per-process random secret is
// used and outstanding tokens simply invalidate on restart (forcing a harmless
// re-verify, since codes are short-lived anyway).
const SECRET = process.env.VERIFY_SECRET || randomBytes(32).toString('hex')

const norm = (email) => String(email || '').trim().toLowerCase()
const sha = (s) => createHash('sha256').update(s).digest('hex')

// email -> { codeHash, expiresAt, attempts, sends: [timestamps], lastSentAt }
const codes = new Map()

// Drop fully-aged entries so the map can't grow unbounded.
const sweep = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of codes) {
    const lastSend = v.sends?.[v.sends.length - 1] || 0
    if (Math.max(v.expiresAt || 0, lastSend) + SEND_WINDOW_MS <= now) codes.delete(k)
  }
}, CODE_TTL_MS)
sweep.unref?.()

export function validEmail(email) {
  const e = norm(email)
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

// Generate + send a code. Returns { ok: true } or, when throttled,
// { ok: false, retryAfter, error }. Throws only if the email send itself fails.
export async function requestCode(email) {
  const key = norm(email)
  const now = Date.now()

  let rec = codes.get(key)
  if (rec) {
    rec.sends = (rec.sends || []).filter(t => now - t < SEND_WINDOW_MS)
    if (rec.lastSentAt && now - rec.lastSentAt < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        retryAfter: Math.ceil((RESEND_COOLDOWN_MS - (now - rec.lastSentAt)) / 1000),
        error: 'Please wait a few seconds before requesting another code.',
      }
    }
    if (rec.sends.length >= MAX_SENDS_PER_WINDOW) {
      return {
        ok: false,
        retryAfter: Math.ceil((SEND_WINDOW_MS - (now - rec.sends[0])) / 1000),
        error: 'Too many codes requested for this email. Please try again later.',
      }
    }
  } else {
    rec = { sends: [] }
    codes.set(key, rec)
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)) // 6 digits, no leading zero
  rec.codeHash = sha(`${key}:${code}`)
  rec.expiresAt = now + CODE_TTL_MS
  rec.attempts = 0
  rec.lastSentAt = now
  rec.sends.push(now)

  await sendCodeEmail(key, code) // throws on hard failure → route returns 502
  return { ok: true }
}

// Check a submitted code. Returns { ok: true, token } or { ok: false, error }.
export function verifyCode(email, code) {
  const key = norm(email)
  const now = Date.now()
  const rec = codes.get(key)

  if (!rec || !rec.codeHash || rec.expiresAt <= now) {
    return { ok: false, error: 'This code has expired. Please request a new one.' }
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many incorrect attempts. Please request a new code.' }
  }

  rec.attempts++
  const got = Buffer.from(sha(`${key}:${String(code || '').trim()}`))
  const want = Buffer.from(rec.codeHash)
  const match = got.length === want.length && timingSafeEqual(got, want)

  if (!match) {
    const left = MAX_ATTEMPTS - rec.attempts
    return {
      ok: false,
      error: left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
        : 'Too many incorrect attempts. Please request a new code.',
    }
  }

  codes.delete(key) // burn the code on success — single use
  return { ok: true, token: issueToken(key) }
}

// HMAC token of `${exp}.${sig}` bound to the email. Stateless: survives restarts
// when VERIFY_SECRET is set, and needs no server-side storage to validate.
export function issueToken(email) {
  const exp = Date.now() + TOKEN_TTL_MS
  const sig = createHmac('sha256', SECRET).update(`${norm(email)}|${exp}`).digest('base64url')
  return `${exp}.${sig}`
}

export function verifyToken(token, email) {
  if (typeof token !== 'string' || !token) return false
  const dot = token.indexOf('.')
  if (dot < 1) return false
  const exp = Number(token.slice(0, dot))
  const sig = token.slice(dot + 1)
  if (!Number.isFinite(exp) || exp <= Date.now()) return false
  const expected = createHmac('sha256', SECRET).update(`${norm(email)}|${exp}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function sendCodeEmail(email, code) {
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback: no email account configured. Log the code so the flow is
    // fully testable locally. NEVER reached in production (key is set there).
    console.log(`[verify] (dev — RESEND_API_KEY unset) code for ${email}: ${code}`)
    return
  }

  const from = process.env.VERIFY_FROM || 'FreshMatch <onboarding@resend.dev>'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)

  let res
  try {
    res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${code} is your FreshMatch verification code`,
        html: codeEmailHtml(code),
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Email service timed out')
    throw err
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${body}`)
  }
}

function codeEmailHtml(code) {
  return `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f1f3a;">
    <p style="font-size:15px;color:#3b4a63;margin:0 0 8px;">FreshMatch by Freshman Academy</p>
    <h1 style="font-size:20px;margin:0 0 16px;color:#0f1f3a;">Verify your email</h1>
    <p style="font-size:15px;line-height:1.5;color:#3b4a63;margin:0 0 20px;">
      Enter this code to unlock your college matches. It expires in 10 minutes.
    </p>
    <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0f1f3a;background:#f4f1ea;border-radius:10px;padding:18px 0;text-align:center;">
      ${code}
    </div>
    <p style="font-size:13px;line-height:1.5;color:#8a94a6;margin:20px 0 0;">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>`
}
