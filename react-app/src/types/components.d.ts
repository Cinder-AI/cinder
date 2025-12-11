declare module './Button.jsx' {
  import { ForwardRefExoticComponent, RefAttributes, ButtonHTMLAttributes } from 'react'

  type ExtraProps = {
    label?: string
    type?: string
    variant?: string
    unstyled?: boolean
    className?: string
  }

  export const Button: ForwardRefExoticComponent<ButtonHTMLAttributes<HTMLButtonElement> & ExtraProps & RefAttributes<HTMLButtonElement>>
}

declare module '../components/Button.jsx' {
  export * from './Button.jsx'
}

