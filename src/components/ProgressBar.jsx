import '../styles/ProgressBar.css'

export default function ProgressBar({ percent }) {
  return (
    <div className="progress-rail">
      <div
        data-testid="progress-fill"
        className="progress-fill"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
