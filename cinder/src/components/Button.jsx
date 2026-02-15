import { forwardRef } from 'react'

export const Button = forwardRef(function Button(
  { children, label, onClick, type = 'default', variant, className = '', unstyled = false, ...props },
  ref,
) {
  const v = variant ?? type ?? 'default'
  const classes = unstyled ? className : `btn btn-${v}${className ? ' ' + className : ''}`
  return (
    <button ref={ref} className={classes} onClick={onClick} {...props}>
      {children ?? label}
    </button>
  )
})
