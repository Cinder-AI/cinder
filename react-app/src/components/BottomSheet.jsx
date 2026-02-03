import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'

export function BottomSheet({ open, onClose, children, closable = true, height = 'auto' }) {
  const backdropRef = useRef(null)
  const sheetRef = useRef(null)
  const [drag, setDrag] = useState({ startY: 0, currentY: 0, isDragging: false })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!open) {
      setIsVisible(false)
      return
    }
    let rafId = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(rafId)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape' && closable) onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closable, onClose])

  if (!open) return null

  const handleBackdropClick = (e) => {
    if (!closable) return
    if (e.target === backdropRef.current) onClose?.()
  }

  const onTouchStart = (e) => {
    setDrag({ startY: e.touches[0].clientY, currentY: e.touches[0].clientY, isDragging: true })
    if (sheetRef.current) sheetRef.current.style.transition = 'none'
  }
  const onTouchMove = (e) => {
    setDrag((d) => {
      const currentY = e.touches[0].clientY
      const diff = Math.max(0, currentY - d.startY)
      if (sheetRef.current) sheetRef.current.style.transform = `translateY(${diff}px)`
      return { ...d, currentY }
    })
  }
  const onTouchEnd = () => {
    setDrag((d) => {
      const diff = d.currentY - d.startY
      if (sheetRef.current) {
        sheetRef.current.style.transition = ''
        sheetRef.current.style.transform = diff > 100 ? 'translateY(100%)' : 'translateY(0)'
      }
      if (diff > 100 && closable) onClose?.()
      return { startY: 0, currentY: 0, isDragging: false }
    })
  }

  return createPortal(
    <div
      className={`bottom-sheet-backdrop ${isVisible ? 'open' : ''}`}
      ref={backdropRef}
      onClick={handleBackdropClick}
    >
      <div
        className={`bottom-sheet ${isVisible ? 'open' : ''}`}
        ref={sheetRef}
        style={{ height }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bottom-sheet-handle"><div className="handle-bar" /></div>
        <div className="bottom-sheet-content">{children}</div>
      </div>
    </div>,
    document.body
  )
}


