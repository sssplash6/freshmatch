export default function Option({ letter, text, selected, dimmed, onClick }) {
  let className = 'option'
  if (selected) className += ' selected'
  if (dimmed) className += ' dimmed'

  return (
    <button type="button" className={className} onClick={onClick}>
      <span className="option-letter">{letter}</span>
      <span className="option-text">{text}</span>
    </button>
  )
}
