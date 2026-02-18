import { useEffect, useRef } from 'react'
import { Button } from '../Button'

export function VerifyEmailForm({ email, onBack, onSuccess }: { email?: string; onBack?: () => void; onSuccess?: (code: string) => void }) {
  const inputsRef = useRef<HTMLInputElement[]>([])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const onChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    if (inputsRef.current[index]) inputsRef.current[index].value = value
    if (value && index < inputsRef.current.length - 1) inputsRef.current[index + 1]?.focus()
  }

  const code = () => inputsRef.current.map(i => i?.value || '').join('')

  return (
    <div className="auth-form verify-email-form">
      <div className="auth-header">
        <h2>Verify your email</h2>
        <p>We've sent a 6-digit code to {email}</p>
        <p>Enter it below to confirm</p>
      </div>
      <div className="auth-body">
        <div className="verification-inputs">
          {Array.from({ length: 6 }).map((_, idx) => (
            <input
              key={idx}
              type="text"
              maxLength={1}
              className="verification-digit"
              inputMode="numeric"
              ref={el => {
                if (el) inputsRef.current[idx] = el
              }}
              onChange={e => onChange(idx, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Backspace' && !e.currentTarget.value && idx > 0) inputsRef.current[idx - 1]?.focus()
              }}
            />
          ))}
        </div>
        <div className="verify-email-buttons">
          <Button label="Back" type="sell" onClick={onBack} />
          <Button label="Confirm" type="buy" onClick={() => { const c = code(); if (c.length === 6) onSuccess?.(c) }} />
        </div>
      </div>
    </div>
  )
}





