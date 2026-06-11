import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import '../styles/CountrySearch.css'

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
  'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
  'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada',
  'Central African Republic','Chad','Chile','China','Colombia','Comoros',
  'Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Democratic Republic of the Congo','Denmark','Djibouti','Dominica',
  'Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea',
  'Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon',
  'Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea',
  'Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan',
  'Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos',
  'Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania',
  'Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta',
  'Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova',
  'Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia',
  'Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria',
  'North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Panama',
  'Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar',
  'Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia',
  'Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe',
  'Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore',
  'Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea',
  'South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland',
  'Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo',
  'Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States',
  'Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam',
  'Yemen','Zambia','Zimbabwe',
]

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
