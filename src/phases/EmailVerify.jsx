import { useEffect, useRef, useState } from 'react'
import { useQuiz } from '../context/QuizContext'
import '../styles/EmailVerify.css'

const RESEND_COOLDOWN = 30 // seconds — mirrors the server-side per-email cooldown

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

export default function EmailVerify() {
  const { state, dispatch } = useQuiz()
  const { email } = state

  const [stage, setStage]     = useState('email') // 'email' | 'code'
  const [code, setCode]       = useState('')
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const emailRef = useRef(null)
  const codeRef  = useRef(null)

  useEffect(() => {
    if (stage === 'email') emailRef.current?.focus()
    else codeRef.current?.focus()
  }, [stage])

  // Resend cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function sendCode() {
    if (busy || !isValidEmail(email)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "We couldn't send your code. Please try again.")
        if (data.retryAfter) setCooldown(Math.min(data.retryAfter, 120))
        return
      }
      setStage('code')
      setCode('')
      setCooldown(RESEND_COOLDOWN)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function checkCode() {
    const trimmed = code.trim()
    if (busy || trimmed.length < 6) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.verifyToken) {
        setError(data.error || 'That code didn\'t work. Please try again.')
        return
      }
      dispatch({ type: 'VERIFIED', token: data.verifyToken })
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function onEmailKey(e) {
    if (e.key === 'Enter') sendCode()
  }
  function onCodeKey(e) {
    if (e.key === 'Enter') checkCode()
  }

  return (
    <div className="card">
      <div className="question-slide slide-forward">
        {stage === 'email' ? (
          <>
            <div className="question-text intake-question">Last step — verify your email</div>
            <p className="verify-sub">
              Your matches are ready. Enter your email and we'll send a 6-digit code to unlock them.
            </p>

            <div className="intake-fields">
              <div className="intake-field-item">
                <label className="intake-label">Email address</label>
                <input
                  ref={emailRef}
                  className="intake-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => dispatch({ type: 'SET_EMAIL', value: e.target.value })}
                  onKeyDown={onEmailKey}
                />
              </div>
            </div>

            {error && <p className="verify-error">{error}</p>}

            <div className="slide-footer">
              <button className="back-btn" onClick={() => dispatch({ type: 'BACK' })}>← Back</button>
              <button
                className={`next-btn${isValidEmail(email) && !busy ? ' active' : ''}`}
                onClick={isValidEmail(email) ? sendCode : undefined}
                disabled={busy}
              >
                {busy ? 'Sending…' : 'Send code →'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="question-text intake-question">Enter your code</div>
            <p className="verify-sub">
              We sent a 6-digit code to <strong>{email.trim()}</strong>. It expires in 10 minutes.
            </p>

            <div className="intake-fields">
              <div className="intake-field-item">
                <label className="intake-label">Verification code</label>
                <input
                  ref={codeRef}
                  className="intake-input verify-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={onCodeKey}
                />
              </div>
            </div>

            {error && <p className="verify-error">{error}</p>}

            <div className="verify-resend-row">
              <button
                className="verify-link"
                onClick={() => { setStage('email'); setError('') }}
                disabled={busy}
              >
                Change email
              </button>
              <button
                className="verify-link"
                onClick={sendCode}
                disabled={busy || cooldown > 0}
              >
                {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
              </button>
            </div>

            <div className="slide-footer">
              <button className="back-btn" onClick={() => dispatch({ type: 'BACK' })}>← Back</button>
              <button
                className={`next-btn${code.trim().length === 6 && !busy ? ' active' : ''}`}
                onClick={code.trim().length === 6 ? checkCode : undefined}
                disabled={busy}
              >
                {busy ? 'Verifying…' : 'Verify →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
