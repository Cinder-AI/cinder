import { useEffect, useRef } from 'react'
import { BondingCurve } from './BondingCurve.jsx'
import { CinderIcon } from './icons/CinderIcon.jsx'
import { TokenMedia } from './TokenMedia'

const SWIPE_THRESHOLD = 120
const SPEED_THRESHOLD = 0.6 // px/ms
const MAX_ROTATION = 12

export function TokenCard({
  ticker,
  description,
  image,
  media,
  progress,
  timeAgo,
  creator,
  isBoosted,
  glow = false,
  onSwipeLeft,
  onSwipeRight,
  controlsRef = null,
  isPreview = false,
}) {
  const wrapperRef = useRef(null)
  const rafRef = useRef(0)
  const timeoutRef = useRef(null)
  const buttonsRef = useRef({ buy: null, pass: null })
  const stateRef = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    isDragging: false,
    nextCard: null,
  })

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      resetButtons()
    }
  }, [])

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const element = wrapperRef.current
    if (!element) return

    e.preventDefault()
    element.setPointerCapture(e.pointerId)

    const now = performance.now()
    stateRef.current.isDragging = true
    stateRef.current.startX = e.clientX
    stateRef.current.startY = e.clientY
    stateRef.current.currentX = e.clientX
    stateRef.current.currentY = e.clientY
    stateRef.current.lastX = e.clientX
    stateRef.current.lastTime = now
    stateRef.current.velocity = 0
    stateRef.current.nextCard = element.parentNode?.querySelector('.next-card')

    cacheButtons()
    element.style.transition = 'none'
    element.style.cursor = 'grabbing'
    scheduleFrame()
  }

  const handlePointerMove = (e) => {
    if (!stateRef.current.isDragging) return
    if (e.pointerType !== 'mouse') e.preventDefault()

    const now = performance.now()
    const deltaX = e.clientX - stateRef.current.lastX
    const deltaTime = Math.max(now - stateRef.current.lastTime, 1)
    const instantVelocity = deltaX / deltaTime

    stateRef.current.currentX = e.clientX
    stateRef.current.currentY = e.clientY
    stateRef.current.lastX = e.clientX
    stateRef.current.lastTime = now
    stateRef.current.velocity = stateRef.current.velocity * 0.6 + instantVelocity * 0.4

    scheduleFrame()
  }

  const handlePointerUp = (e) => {
    if (!stateRef.current.isDragging) return
    const element = wrapperRef.current
    if (!element) return

    stateRef.current.isDragging = false
    if (element.hasPointerCapture(e.pointerId)) {
      element.releasePointerCapture(e.pointerId)
    }

    finalizeSwipe()
  }

  const scheduleFrame = () => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      paintDrag()
    })
  }

  const paintDrag = () => {
    const element = wrapperRef.current
    if (!element || !stateRef.current.isDragging) return

    const deltaX = stateRef.current.currentX - stateRef.current.startX
    const translateX = deltaX * 0.85
    const translateY = Math.min(Math.abs(deltaX) * 0.12, 90)
    const rotation = Math.max(Math.min(deltaX * 0.025, MAX_ROTATION), -MAX_ROTATION)

    element.style.transform = `translate(${translateX}px, ${translateY}px) rotate(${rotation}deg)`
    updatePreview(deltaX)
    animateButtons(deltaX)
    updateSwipeClasses(element, deltaX)
  }

  const updatePreview = (deltaX) => {
    const nextCard = stateRef.current.nextCard
    if (!nextCard) return

    const progress = Math.min(Math.abs(deltaX) / 140, 1)
    nextCard.style.opacity = String(0.3 + progress * 0.4)
    nextCard.style.transform = `scale(${0.95 + progress * 0.04})`
  }

  const finalizeSwipe = () => {
    const element = wrapperRef.current
    if (!element) return

    const deltaX = stateRef.current.currentX - stateRef.current.startX
    const velocity = stateRef.current.velocity
    const shouldSwipeRight = deltaX > SWIPE_THRESHOLD || (velocity > SPEED_THRESHOLD && deltaX > 40)
    const shouldSwipeLeft = deltaX < -SWIPE_THRESHOLD || (velocity < -SPEED_THRESHOLD && deltaX < -40)

    element.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease'
    element.style.cursor = 'grab'

    if (shouldSwipeRight) {
      revealNextCard()
      flyOut('right', velocity)
      return
    }

    if (shouldSwipeLeft) {
      revealNextCard()
      flyOut('left', velocity)
      return
    }

    resetPreview()
    element.style.transform = 'translate(0, 0) rotate(0deg)'
    element.classList.remove('swiping-right', 'swiping-left')
    resetButtons()
  }

  const flyOut = (direction, velocity) => {
    const element = wrapperRef.current
    if (!element) return

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const exitX = direction === 'right' ? viewportWidth * 1.2 : -viewportWidth * 1.2
    const exitY = 0
    const rotation = 0

    element.classList.remove('swiping-right', 'swiping-left')
    element.style.transform = `translate(${exitX}px, ${exitY}px) rotate(${rotation}deg)`
    element.style.opacity = '0'

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      resetButtons()
      if (direction === 'right') {
        onSwipeRight?.()
      } else {
        onSwipeLeft?.()
      }
    }, 320)
  }

  const revealNextCard = () => {
    if (!stateRef.current.nextCard) return
    stateRef.current.nextCard.style.opacity = '1'
    stateRef.current.nextCard.style.transform = 'scale(1)'
    stateRef.current.nextCard = null
  }

  const updateSwipeClasses = (element, deltaX) => {
    if (deltaX > 50) {
      element.classList.add('swiping-right')
      element.classList.remove('swiping-left')
    } else if (deltaX < -50) {
      element.classList.add('swiping-left')
      element.classList.remove('swiping-right')
    } else {
      element.classList.remove('swiping-right', 'swiping-left')
    }
  }

  const animateButtons = (deltaX) => {
    const buyBtn = buttonsRef.current.buy
    const passBtn = buttonsRef.current.pass
    if (!buyBtn || !passBtn) return

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const maxDelta = viewportWidth * 0.35
    const progress = Math.min(Math.abs(deltaX) / maxDelta, 1)

    if (Math.abs(deltaX) < 20) {
      buyBtn.style.transform = 'scale(1)'
      buyBtn.style.opacity = '1'
      buyBtn.style.background = ''
      passBtn.style.transform = 'scale(1)'
      passBtn.style.opacity = '1'
      passBtn.style.background = ''
      return
    }

    if (deltaX > 0) {
      const scale = 1 + progress * 0.35
      const opacity = Math.min(0.85 + progress * 0.3, 1)
      const startColor = { r: 255, g: 196, b: 92 }
      const endColor = { r: 247, g: 156, b: 82 }
      const currentR = Math.round(startColor.r + (endColor.r - startColor.r) * progress)
      const currentG = Math.round(startColor.g + (endColor.g - startColor.g) * progress)
      const currentB = Math.round(startColor.b + (endColor.b - startColor.b) * progress)

      buyBtn.style.transform = `scale(${scale})`
      buyBtn.style.opacity = String(opacity)
      buyBtn.style.background = `rgb(${currentR}, ${currentG}, ${currentB})`
      passBtn.style.transform = `scale(${1 - progress * 0.2})`
      passBtn.style.opacity = String(Math.max(0.5, 1 - progress * 0.35))
      passBtn.style.background = ''
      return
    }

    const scale = 1 + progress * 0.35
    const opacity = Math.min(0.85 + progress * 0.3, 1)
    passBtn.style.transform = `scale(${scale})`
    passBtn.style.opacity = String(opacity)
    passBtn.style.background = `rgba(245, 245, 245, ${opacity})`
    buyBtn.style.transform = `scale(${1 - progress * 0.2})`
    buyBtn.style.opacity = String(Math.max(0.5, 1 - progress * 0.35))
    buyBtn.style.background = ''
  }

  const cacheButtons = () => {
    if (controlsRef?.buy?.current || controlsRef?.pass?.current) {
      buttonsRef.current.buy = controlsRef.buy?.current ?? buttonsRef.current.buy
      buttonsRef.current.pass = controlsRef.pass?.current ?? buttonsRef.current.pass
      return
    }

    if (!buttonsRef.current.buy) {
      buttonsRef.current.buy = document.querySelector('.buy-btn')
    }
    if (!buttonsRef.current.pass) {
      buttonsRef.current.pass = document.querySelector('.pass-btn')
    }
  }

  const resetButtons = () => {
    const buyBtn = buttonsRef.current.buy
    const passBtn = buttonsRef.current.pass
    if (buyBtn) {
      buyBtn.style.transform = ''
      buyBtn.style.opacity = ''
      buyBtn.style.background = ''
    }
    if (passBtn) {
      passBtn.style.transform = ''
      passBtn.style.opacity = ''
      passBtn.style.background = ''
    }
  }

  const resetPreview = () => {
    if (!stateRef.current.nextCard) return
    stateRef.current.nextCard.style.opacity = '0.3'
    stateRef.current.nextCard.style.transform = 'scale(0.95)'
    stateRef.current.nextCard = null
  }

  const boostIcon = () => {
    if (!isBoosted) return null
    return (
      <div className="boost-icon">
        <CinderIcon styles={{ alignSelf: 'flex-start'}} />
      </div>
    )
  }

  const mediaSource = media ?? (image ? { type: 'image', src: image } : null)

  return (
    <div
      className={`token-card-wrapper${isBoosted ? ' token-card-wrapper--boosted' : ''}${glow ? ' token-card-wrapper--glow' : ''}`}
      ref={wrapperRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: 'grab', touchAction: 'none' }}
    >
      <div className="token-card">
        <TokenMedia
          media={mediaSource}
          fallbackSrc={image}
          alt={ticker}
          className="token-card-media"
          showPosterOnly={isPreview}
        />
        <div className="token-card-header">
          <div className="token-card-info">
            <div className="token-card-info-content">
              <span className="token-description">{description}</span>
              <h2 className="token-ticker">{ticker}</h2>
            </div>
            {boostIcon()}
          </div>
          <div className="token-card-creator">
            <span className="token-creator">{creator}</span>
            <span className="token-time">{timeAgo}</span>
          </div>
        </div>
        <div className="token-card-footer">
          <BondingCurve progress={progress} glow={glow} />
        </div>
      </div>
    </div>
  )
}