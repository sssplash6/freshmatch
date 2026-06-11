import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ALL_MAJORS } from '../data/majors'
import '../styles/DreamSchoolSearch.css'

const MAX = 3

export default function MajorSearch({ value, onChange, direction, onNext, onBack, sectionLabel, counter }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const wrapRef = useRef(null)

  const selected = value || []

  const filtered = query.trim().length === 0
    ? []
    : ALL_MAJORS
        .filter(m => !selected.includes(m))
        .filter(m => m.toLowerCase().includes(query.trim().toLowerCase()))
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

  function add(major) {
    if (selected.length >= MAX) return
    onChange([...selected, major])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function remove(major) {
    onChange(selected.filter(m => m !== major))
  }

  return (
    <div className={`question-slide slide-${direction}`}>
      <div className="slide-header">
        <span className="section-label">{sectionLabel}</span>
        <span className="q-counter">{counter}</span>
      </div>

      <div className="question-text">Desired majors</div>
      <div className="question-hint">
        Pick up to 3 majors you want to study. We'll match you with schools strong in them.
      </div>

      <div className="dsearch-wrap" ref={wrapRef}>
        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="dsearch-chips">
            {selected.map(m => (
              <div key={m} className="dsearch-chip">
                <span className="dsearch-chip__name">{m}</span>
                <button
                  className="dsearch-chip__remove"
                  onClick={() => remove(m)}
                  type="button"
                  aria-label={`Remove ${m}`}
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
              placeholder={selected.length === 0 ? 'Search for a major…' : 'Add another…'}
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
                {filtered.map(m => (
                  <button
                    key={m}
                    className="dsearch-option"
                    type="button"
                    onMouseDown={e => { e.preventDefault(); add(m) }}
                  >
                    <span className="dsearch-option__name">{m}</span>
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
                <div className="dsearch-empty">No majors found</div>
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
