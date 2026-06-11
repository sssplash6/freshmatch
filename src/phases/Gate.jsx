import { useState } from 'react'
import '../styles/Gate.css'
import { useQuiz } from '../context/QuizContext'

export default function Gate() {
  const { dispatch } = useQuiz()
  const [token, setToken]   = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | error
  const [error, setError]   = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!token.trim() || status === 'checking') return
    setStatus('checking')
    setError('')
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        sessionStorage.setItem('fa-unlocked', '1')
        dispatch({ type: 'UNLOCK' })
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(res.status === 401 ? "That access code isn't valid." : (data.error || `Error ${res.status}`))
      setStatus('error')
    } catch {
      setError('Could not reach the server — please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
        <div className="gate-brand">Freshman Academy</div>
        <h1 className="gate-title">Enter your access code</h1>
        <p className="gate-sub">This calculator is invite-only. Enter the code you were given to continue.</p>

        <input
          className={`gate-input${status === 'error' ? ' gate-input--error' : ''}`}
          type="text"
          value={token}
          onChange={e => { setToken(e.target.value); if (status === 'error') setStatus('idle') }}
          placeholder="Access code"
          autoFocus
          autoComplete="off"
          spellCheck="false"
          aria-label="Access code"
        />

        {status === 'error' && <div className="gate-error">{error}</div>}

        <button
          type="submit"
          className={`gate-btn${token.trim() && status !== 'checking' ? ' active' : ''}`}
        >
          {status === 'checking' ? 'Checking…' : 'Continue →'}
        </button>
      </form>
    </div>
  )
}
