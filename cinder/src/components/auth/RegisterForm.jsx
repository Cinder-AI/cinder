import { Button } from '../Button.jsx'
import { useState } from 'react'

export function RegisterForm({ onVerify }) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [waitlist, setWaitlist] = useState(false)
  return (
    <div className="auth-form">
      <div className="auth-header">
        <h2>Create Account</h2>
        <p>Join CINDER and start your memecoins journey</p>
      </div>
      <div className="auth-body">
        <div className="input-group">
          <input type="email" placeholder="Enter your email" className="auth-input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="input-group">
          <input type="text" placeholder="Choose username" className="auth-input" value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <label className="checkbox-label">
          <input type="checkbox" className="auth-checkbox" checked={waitlist} onChange={e => setWaitlist(e.target.checked)} />
          <span className="checkbox-text">Sign up for waitlist</span>
        </label>
        <Button label="Confirm email" type="sell" onClick={() => email && username && onVerify?.(email, { username, signUpForWaitlist: waitlist })} className="auth-submit" />
      </div>
    </div>
  )
}





