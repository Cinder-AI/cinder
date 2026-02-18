import { forwardRef } from 'react'

import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  label?: string
  type?: string
  variant?: string
  unstyled?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
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
  },
)
