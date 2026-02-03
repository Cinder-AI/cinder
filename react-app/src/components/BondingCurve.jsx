export function BondingCurve({ progress, glow = false, showText = true }) {
  const normalized = Math.min(Math.max(progress ?? 0, 0), 100)
  const displayValue = Number(normalized.toFixed(0))
  const isHot = normalized >= 80

  return (
    <div className={`bonding-curve${glow ? ' bonding-curve--glow' : ''}`}>
      <div className="bonding-progress">
        <div
          className={`bonding-fill${isHot ? ' bonding-fill--hot' : ''}`}
          style={{ width: `${normalized}%`, transition: 'none' }}
        />
      </div>
      <span className="bonding-text">{displayValue}% {showText ? 'Bonded' : ''}</span>
    </div>
  )
}