import { Button } from '../Button.jsx'
import { useState } from 'react'

export function LoginForm({ onVerify }) {
  const [email, setEmail] = useState('')
  return (
    <div className="auth-form">
      <div className="auth-header">
        <h2>Login</h2>
        <p>Step back into CINDER and keep the fire alive</p>
      </div>
      <div className="auth-body">
        <div className="input-group">
          <input type="email" placeholder="Enter your email" className="auth-input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <Button label="Confirm email" type="sell" onClick={() => email && onVerify?.(email)} className="auth-submit" />
      </div>
    </div>
  )
}





