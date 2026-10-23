import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import '../styles/CountrySearch.css'
import { COUNTRIES } from '../data/countries'

export default function CountrySearch({ value, onChange }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const filtered = query.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES

  function updatePos() {
    const rect = inputRef.current?.getBoundingClientRect()
    if (rect) setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  function openDropdown() {
    updatePos()
    setOpen(true)
  }

  function select(country) {
    setQuery(country)
    onChange(country)
    setOpen(false)
  }

  function handleInput(e) {
    const v = e.target.value
    setQuery(v)
    onChange('')
    openDropdown()
    setHighlighted(0)
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') openDropdown()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlighted]) select(filtered[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.children[highlighted]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted, open])

  useEffect(() => {
    function handleClick(e) {
      if (!inputRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) {
        setOpen(false)
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

  return (
    <div className="country-search">
      <input
        ref={inputRef}
        className="intake-input"
        type="text"
        placeholder="Search country…"
        value={query}
        onChange={handleInput}
        onFocus={openDropdown}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && filtered.length > 0 && createPortal(
        <ul
          className="country-dropdown"
          ref={listRef}
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
        >
          {filtered.map((c, i) => (
            <li
              key={c}
              className={`country-option${i === highlighted ? ' highlighted' : ''}`}
              onMouseDown={() => select(c)}
              onMouseEnter={() => setHighlighted(i)}
            >
              {c}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}
