import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreProvider.jsx'
import { useConnect, useConnectUI, useIsConnected } from '@fuels/react'

import { Button } from './Button.jsx'
import { ProfilePopup } from './ProfilePopup.tsx'
import Logo from '@assets/fire.svg'
import FuelLogo from '@assets/fuel.png'
import WalletIcon from '@assets/wallet.svg'
import { BackButtonIcon } from './icons/BackButtonIcon.jsx'
import { CinderIcon } from './icons/CinderIcon.jsx'

export function Header({ title = 'Cinder', showCreate = false, showBalance = false, showBackButton = false }) {
  const navigate = useNavigate()
  const { getUserHoldings } = useStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const { connect } = useConnectUI()
  const { _connect } = useConnect()
  const { isConnected, refetch } = useIsConnected()

  useEffect(() => {
    refetch()
  }, [refetch])

  const holdings = getUserHoldings()
  const balance = {
    stFUEL: holdings.find(h => h.id === 1)?.amount ?? 0,
    CIN: holdings.find(h => h.id === 2)?.amount ?? 0,
  }

  function toggleProfile(e) {
    e.stopPropagation()
    setProfileOpen(prev => !prev)
  }

  const onConnectClick = () => {
    connect()
  }

  const onLogoClick = () => {
    navigate('/discovery')
  }

  const onCreateClick = () => {
    navigate('/create')
  }

  const profile = () => {
    if (isConnected) {
      return (
        <div className="profile-div" onClick={toggleProfile}>
          <img src="/assets/profile_pic.png" alt="Profile" />
          <ProfilePopup isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
        </div>
      )
    } else {
      return (
        <div className="profile-div" onClick={onConnectClick}>
          <img src={WalletIcon} alt="Wallet" />
        </div>
      )
    }
  }

  const backButton = () => {
    if(showBackButton) {
      return (
        <BackButtonIcon onClick={() => navigate(-1)} />
      )
    } else {
      return (
        <div className="logo" onClick={onLogoClick}>
          <CinderIcon />
        </div>
      )
    }
  }

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="header-left">
          {backButton()}
        </div>

        <div className="header-buttons">
          {isConnected && showCreate && (
            <Button label="+ Create" type="create" className="header-create-btn" onClick={onCreateClick} />
          )}
          {isConnected && showBalance && (
            <div className="header-balance">$CIN {balance.CIN}</div>
          )}
          {profile()}
        </div>
      </div>
    </header>
  )
}