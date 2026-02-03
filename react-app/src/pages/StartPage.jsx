import { useState } from 'react'
import { BottomSheet } from '../components/BottomSheet.jsx'
import { LoginForm } from '../components/auth/LoginForm.jsx'
import { RegisterForm } from '../components/auth/RegisterForm.jsx'
import { VerifyEmailForm } from '../components/auth/VerifyEmailForm.jsx'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button.jsx'

export function StartPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetContent, setSheetContent] = useState(null)

  const screens = [
    { id: 'welcome1', title: 'Meet Cinder', description: 'Swipe-first memecoins...', image: '/assets/welcome1.png', showBondingCurve: false, buttons: [{ label: 'Continue', action: () => setStep(1) }] },
    { id: 'welcome2', title: 'Reserve > Regret', description: 'Secure your spot...', image: '/assets/welcome2.png', showBondingCurve: true, buttons: [{ label: 'Continue', action: () => setStep(2) }] },
    { id: 'welcome3', title: 'Recycle & Airdrop', description: 'If a coin dies...', image: '/assets/welcome3.png', showBondingCurve: false, buttons: [{ label: 'Login', action: () => openLogin() }, { label: 'Create Account', action: () => openRegister() }] },
  ]

  function openLogin() {
    setSheetContent(<LoginForm onVerify={(email) => openVerify(email, 'login')} />)
    setSheetOpen(true)
  }
  function openRegister() {
    setSheetContent(<RegisterForm onVerify={(email, userData) => openVerify(email, 'register', userData)} />)
    setSheetOpen(true)
  }
  function openVerify(email, type, userData) {
    setSheetContent(<VerifyEmailForm email={email} onBack={() => { type === 'login' ? openLogin() : openRegister() }} onSuccess={(code) => { localStorage.setItem('isLoggedIn', 'true'); localStorage.setItem('userEmail', email); if (userData) localStorage.setItem('userData', JSON.stringify(userData)); setSheetOpen(false); navigate('/discovery') }} />)
  }

  const s = screens[step]

  return (
    <div className="start-page">
      <div className={`welcome-screen welcome-screen-${s.id}`}>
        <div className="welcome-image-section"><img src={s.image} alt={s.title} /></div>
        <div className="welcome-info-section">
          <div className="progress-dots">{[0,1,2].map(i => <div key={i} className={`progress-dot ${i === step ? 'active' : ''}`} />)}</div>
          <div className="welcome-text-section">
            <h1 className="welcome-title">{s.title}</h1>
            <p className="welcome-description">{s.description}</p>
          </div>
          <div className="welcome-buttons-section">
            <div className="welcome-buttons">
              {s.buttons.map((b, idx) => (
                <Button key={idx} type={b.label === 'Create Account' ? 'buy' : 'sell'} onClick={b.action} label={b.label} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>{sheetContent}</BottomSheet>
    </div>
  )
}


