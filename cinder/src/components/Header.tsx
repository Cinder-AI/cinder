import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreProvider'
import { useConnect, useConnectUI, useIsConnected } from '@fuels/react'
import { useContracts } from '../hooks/useContracts'
import { useWallet } from '@fuels/react'
import { getContracts } from '../config/contracts.ts'

import { Button } from './Button'
import { ProfilePopup } from './ProfilePopup'
import Logo from '@assets/fire.svg'
import FuelLogo from '@assets/fuel.png'
import WalletIcon from '@assets/wallet.svg'
import { BackButtonIcon } from './icons/BackButtonIcon'
import { CinderIcon } from './icons/CinderIcon'
import { Fuel } from '../sway-api/contracts/Fuel.ts'

export function Header({ title = 'Cinder', showCreate = false, showBalance = false, showBackButton = false }) {
  const navigate = useNavigate()
  const { getUserHoldings, getUserBalance } = useStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const { connect } = useConnectUI()
  const { isConnected, refetch } = useIsConnected()
  const { wallet } = useWallet()
  const ids = getContracts()
  const contracts  = useContracts()
  const launchpadContract = contracts?.launchpad
  const [fuelContract, setFuelContract] = useState(null)

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!launchpadContract) return;
      const ids = await getContracts();
      if (cancelled || !ids?.FUEL) return;
      setFuelContract(new Fuel(ids.FUEL, launchpadContract.account));
    })();

    return () => {
      cancelled = true;
    };
  }, [launchpadContract]);
  
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

  const onFaucetClick = async () => {
    if (!fuelContract || !wallet) return;
    console.log('op')
    let owner = await fuelContract.functions.owner().get();
    console.log('owner', owner)
    if (owner.value === 'Uninitialized') {
      console.log(launchpadContract.account)
      const address = { Address: { bits: launchpadContract.account.address.toB256() } }
      const { waitForResult } = await fuelContract.functions.initialize(address).call();
      const { value } = await waitForResult();
      console.log('value', value)
    }
    const recipient = { Address: { bits: wallet.address.toB256() } };
    await fuelContract.functions.mint(recipient, 2000000 * 1_000_000_000).call();
  };

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
          <button onClick={onFaucetClick}>faucet</button>
        </div>

        <div className="header-buttons">
          {isConnected && showCreate && (
            <Button label="+ Create" type="create" className="header-create-btn" onClick={onCreateClick} />
          )}
          {isConnected && showBalance && (
            <div className="header-balance">$CIN {getUserBalance?.() ?? ''}</div>
          )}
          {profile()}
        </div>
      </div>
    </header>
  )
}