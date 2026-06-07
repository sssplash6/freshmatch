import '../styles/EfcSlide.css'

const OPTIONS = [
  { label: '$0 – $15,000',      value: 15000  },
  { label: '$15,001 – $25,000', value: 25000  },
  { label: '$25,001 – $40,000', value: 40000  },
  { label: '$40,001 – $60,000', value: 60000  },
  { label: '$60,001 – $80,000', value: 80000  },
  { label: '$80,001+',          value: 999999 },
]

export default function EfcSlide({ efc, onUpdate, sectionLabel, counter, onNext, onBack }) {
  return (
    <div className="efc-slide">
      <div className="efc-slide__meta">
        <span className="efc-slide__section">{sectionLabel}</span>
        <span className="efc-slide__counter">{counter}</span>
      </div>

      <h2 className="efc-slide__question">
        What is your family's Expected Family Contribution (EFC)?
      </h2>
      <p className="efc-slide__hint">
        Your EFC is the amount your family is expected to pay towards college costs per year.
      </p>

      <div className="efc-slide__options">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`efc-slide__option${efc === opt.value ? ' efc-slide__option--selected' : ''}`}
            onClick={() => onUpdate(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="efc-slide__actions">
        <button className="efc-slide__back" onClick={onBack}>← Back</button>
        <button
          className="efc-slide__next"
          onClick={onNext}
          disabled={efc === null}
        >
          See My Results →
        </button>
      </div>
    </div>
  )
}
