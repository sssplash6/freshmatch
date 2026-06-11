import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ALL_SCHOOLS } from '../data/schools'
import { schoolBadge } from '../data/schoolLogos'
import '../styles/DreamSchoolSearch.css'

const MAX = 3

function SchoolLogo({ id, name }) {
  const { path, monogram } = schoolBadge(id, name)
  const [err, setErr] = useState(false)

  if (path && !err) {
    return (
      <div className="dsearch-logo dsearch-logo--img">
        <img src={path} alt="" onError={() => setErr(true)} />
      </div>
    )
  }
  return <div className="dsearch-logo dsearch-logo--mono">{monogram}</div>
}

export default function DreamSchoolSearch({ value, onChange, direction, onNext, onBack, sectionLabel, counter }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const wrapRef = useRef(null)

  const selected = value || []

  const filtered = query.trim().length === 0
    ? []
    : ALL_SCHOOLS
        .filter(s => !selected.find(sel => sel.id === s.id))
        .filter(s => s.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)

  function updatePos() {
    const rect = inputRef.current?.getBoundingClientRect()
    if (rect) setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  function openDropdown() {
    updatePos()
    setOpen(true)
  }

  useEffect(() => {
    function handleClick(e) {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        listRef.current && !listRef.current.contains(e.target)
      ) {
        setOpen(false)
        setQuery('')
      }
    }
    function handleScroll() { if (open) updatePos() }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  function add(school) {
    if (selected.length >= MAX) return
    onChange([...selected, school])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function remove(id) {
    onChange(selected.filter(s => s.id !== id))
  }

  return (
    <div className={`question-slide slide-${direction}`}>
      <div className="slide-header">
        <span className="section-label">{sectionLabel}</span>
        <span className="q-counter">{counter}</span>
      </div>

      <div className="question-text">Dream schools</div>
      <div className="question-hint">
        Pick up to 3 schools. We'll evaluate your real chances at each one.
      </div>

      <div className="dsearch-wrap" ref={wrapRef}>
        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="dsearch-chips">
            {selected.map(s => (
              <div key={s.id} className="dsearch-chip">
                <SchoolLogo id={s.id} name={s.name} />
                <span className="dsearch-chip__name">{s.name}</span>
                <button
                  className="dsearch-chip__remove"
                  onClick={() => remove(s.id)}
                  type="button"
                  aria-label={`Remove ${s.name}`}
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Search input */}
        {selected.length < MAX && (
          <div className="dsearch-input-wrap">
            <input
              ref={inputRef}
              className="dsearch-input"
              type="text"
              placeholder={selected.length === 0 ? 'Search for a school…' : 'Add another…'}
              value={query}
              onChange={e => { setQuery(e.target.value); openDropdown() }}
              onFocus={openDropdown}
              autoComplete="off"
            />
            {/* Dropdown */}
            {open && filtered.length > 0 && createPortal(
              <div
                className="dsearch-dropdown"
                ref={listRef}
                style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
              >
                {filtered.map(s => (
                  <button
                    key={s.id}
                    className="dsearch-option"
                    type="button"
                    onMouseDown={e => { e.preventDefault(); add(s) }}
                  >
                    <SchoolLogo id={s.id} name={s.name} />
                    <span className="dsearch-option__name">{s.name}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
            {open && query.trim().length > 0 && filtered.length === 0 && createPortal(
              <div
                className="dsearch-dropdown"
                ref={listRef}
                style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
              >
                <div className="dsearch-empty">No schools found</div>
              </div>,
              document.body
            )}
          </div>
        )}
      </div>

      <div className="slide-footer">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <button className="next-btn active" onClick={onNext}>
          {selected.length > 0 ? 'Continue →' : 'Skip →'}
        </button>
      </div>
    </div>
  )
}
