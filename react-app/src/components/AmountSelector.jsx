import { useEffect, useRef, useState } from 'react'
import { Button } from './Button.jsx'

export function AmountSelector({ balance, onAmountChange, tokenName = 'stFUEL', amount = 0, minRange = 0, maxRange = 500, showButtons = false }) {
  const [currentAmount, setCurrentAmount] = useState(amount)
  const sliderRef = useRef(null)

  const amounts = [
    { label: '1k', value: 1000 },
    { label: '10k', value: 10000 },
    { label: '100k', value: 100000 },
    { label: 'Custom', value: 'custom' },
  ]

  useEffect(() => {
    onAmountChange?.(currentAmount)
  }, [currentAmount])

  useEffect(() => {
    if (!sliderRef.current) return
    const el = sliderRef.current
    const min = parseInt(el.min)
    const max = parseInt(el.max)
    const percent = ((currentAmount - min) / (max - min)) * 100
    updateSliderFill(el, percent)
  }, [currentAmount])

  function updateSliderFill(slider, percent) {
    const existingFill = slider.parentNode.querySelector('.slider-fill')
    if (existingFill) existingFill.remove()
    const thumbWidth = 20
    const sliderWidth = slider.offsetWidth
    const maxFillWidth = sliderWidth - thumbWidth
    const fillWidth = (maxFillWidth * percent) / 100
    const fill = document.createElement('div')
    fill.className = 'slider-fill'
    fill.style.cssText = `position: absolute; top: 25%; left: 0; transform: translateY(-50%); height: 6px; background: #000; border-radius: 3px; width: ${fillWidth}px; pointer-events: none; z-index: 1;`
    slider.parentNode.style.position = 'relative'
    slider.parentNode.appendChild(fill)
  }

  const ammountButtons = amounts.map(({ label, value }) => (
    <button
      key={label}
      className={`amount-btn ${value === currentAmount ? 'active' : ''}`}
      onClick={() => {
        if (value === 'custom') return
        setCurrentAmount(value)
      }}
    >
      {label}
    </button>
  ))
  
  return (
    <div className="amount-selector">
      <div className="amount-buttons">
        {showButtons && ammountButtons}
      </div>

      <div className="custom-slider" style={{ display: 'block' }}>
        <input ref={sliderRef} type="range" min={minRange} max={maxRange} value={currentAmount} className="slider" onChange={e => setCurrentAmount(parseInt(e.target.value))} />
        <div className="slider-value">{currentAmount >= 1000 ? Math.round(currentAmount / 1000) + 'k' : currentAmount} {tokenName}</div>
      </div>

      <div className="balance-text">Balance: {balance}</div>
    </div>
  )
}


