import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreProvider.jsx'
import { useConnect, useConnectUI, useIsConnected } from '@fuels/react'
import { useBalance } from '../hooks/useBalance.tsx'
import { useContracts } from '../hooks/useContracts.tsx'
import { useWallet } from '@fuels/react'
import { getContracts } from '../config/contracts.ts'

import { Button } from './Button.jsx'
import { ProfilePopup } from './ProfilePopup.tsx'
import Logo from '@assets/fire.svg'
import FuelLogo from '@assets/fuel.png'
import WalletIcon from '@assets/wallet.svg'
import { BackButtonIcon } from './icons/BackButtonIcon.jsx'
import { CinderIcon } from './icons/CinderIcon.jsx'
import { Fuel } from '../sway-api/contracts/Fuel.ts'

export function Header({ title = 'Cinder', showCreate = false, showBalance = false, showBackButton = false }) {
  const navigate = useNavigate()
  const { getUserHoldings } = useStore()
  const { balances } = useBalance()
  const [profileOpen, setProfileOpen] = useState(false)
  const { connect } = useConnectUI()
  const { _connect } = useConnect()
  const { isConnected, refetch } = useIsConnected()
  const { wallet } = useWallet()
  const ids = getContracts()
  const contracts  = useContracts()
  const launchpadContract = contracts?.launchpad
  const [fuelContract, setFuelContract] = useState(null)
  const cinBalance = useMemo(() => {
    const cin = balances.find(b => b.metadata?.symbol === 'CIN' || b.metadata?.name === 'CIN')
    return cin?.amount ?? '0'
  }, [balances])

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!launchpadContract) return;
      const ids = await getContracts();
      if (cancelled || !ids?.FUEL) return;
      setFuelContract(new Fuel(ids.FUEL, launchpadContract.account));
      const { value: campaigns } = await launchpadContract.functions.get_campaigns().get();
      const normalized = campaigns.map(c => ({
        ...c,
        target: c.target.toString(10),
        total_pledged: c.total_pledged.toString(10),
        total_supply: c.total_supply.toString(10),
        curve: {
          sold_supply: c.curve.sold_supply.toString(10),
          max_supply: c.curve.max_supply.toString(10),
          base_price: c.curve.base_price.toString(10),
          slope: c.curve.slope.toString(10),
        },
        amm_reserved: c.amm_reserved.toString(10),
      }));
      console.log('normalized', normalized);
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
            <div className="header-balance">$CIN {cinBalance}</div>
          )}
          {profile()}
        </div>
      </div>
    </header>
  )
}