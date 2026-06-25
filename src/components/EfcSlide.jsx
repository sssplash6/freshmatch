import '../styles/EfcSlide.css'

const OPTIONS = [
  { label: '$0 – $15,000',      value: 15000  },
  { label: '$15,001 – $25,000', value: 25000  },
  { label: '$25,001 – $40,000', value: 40000  },
  { label: '$40,001 – $60,000', value: 60000  },
  { label: '$60,001 – $80,000', value: 80000  },
  { label: '$80,001+',          value: 999999 },
]

export default function EfcSlide({ efc, onUpdate, consentData, consentOffers, onConsent, sectionLabel, counter, onNext, onBack }) {
  const canContinue = efc !== null && consentData
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

      <div className="efc-consent">
        <label className="efc-consent__row">
          <input
            type="checkbox"
            className="efc-consent__box"
            checked={consentData}
            onChange={e => onConsent('consentData', e.target.checked)}
          />
          <span className="efc-consent__text">
            I consent to Freshman Academy collecting and storing my data for usage in FreshMatch's college fit calculation.
            <span className="efc-consent__req"> Required</span>
          </span>
        </label>

        <label className="efc-consent__row">
          <input
            type="checkbox"
            className="efc-consent__box"
            checked={consentOffers}
            onChange={e => onConsent('consentOffers', e.target.checked)}
          />
          <span className="efc-consent__text">
            Freshman Academy is always eager to work with promising high school students, especially across the post-Soviet space, on a paid or scholarship basis. Consent to the following point to receive curated offers for Freshman programs, such as Full Support, Scholars, etc.
          </span>
        </label>
      </div>

      <div className="efc-slide__actions">
        <button className="efc-slide__back" onClick={onBack}>← Back</button>
        <button
          className="efc-slide__next"
          onClick={canContinue ? onNext : undefined}
          disabled={!canContinue}
        >
          See My Results →
        </button>
      </div>
    </div>
  )
}
