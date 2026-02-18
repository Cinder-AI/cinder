import { Header } from './Header.jsx'

export function Layout({ children, title, headerOptions = {}, hideHeader = false }) {
  return (
    <div className="layout">
      {!hideHeader && <Header title={title} {...headerOptions} />}
      <main className="page-content">{children}</main>
    </div>
  )
}
