import { Input } from './Input.jsx'

export function Field({ title, placeholder, value, onChange }) {
  return (
    <div className="field">
      {title && <div className="field-title">{title}</div>}
      <Input placeholder={placeholder} value={value} onChange={e => onChange?.(e.target.value)} />
    </div>
  )
}


export function TextArea({ title, placeholder, value, onChange }) {
  return (
    <div className="field">
      {title && <div className="field-title">{title}</div>}
      <textarea 
        className="text-area"
        placeholder={placeholder} 
        value={value} 
        onChange={e => onChange?.(e.target.value)} 
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  )
}