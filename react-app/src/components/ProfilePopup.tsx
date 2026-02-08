import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDisconnect } from '@fuels/react'
import { Button } from './Button.jsx'

interface ProfilePopupProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfilePopup({ isOpen, onClose }: ProfilePopupProps) {
  const navigate = useNavigate()
  const { disconnect } = useDisconnect()
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen, onClose])

  const  handleLogout = () => {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userData')
    disconnect()
    onClose()
    navigate('/discovery')
    closePopup()
  }

  const handleHoldings = () => {
    navigate('/holdings')
    onClose()
    closePopup()
  }

  const closePopup = () => {
    popupRef.current?.classList.remove('show');
  }

  if (!isOpen) return null

  return (
    <div ref={popupRef} className={`profile-popup ${isOpen ? 'show' : ''}`}>
      <Button type="secondary" label="Discovery" onClick={() => navigate('/discovery')} />
      <Button type="secondary" label="Leaderboard" onClick={() => navigate('/leaderboard')} />
      <Button type="secondary" label="Holdings" onClick={handleHoldings} />
      <Button type="secondary" label="Logout" onClick={handleLogout} />
    </div>
  )
}