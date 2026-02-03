import { Button } from '../Button.jsx'
import { useNavigate } from 'react-router-dom'

export function CoinCreatedNotification({ token }) {
  const navigate = useNavigate()
  return (
    <div className="coin-created-notification">
      <div className="coin-created-notification-info">
        <div className="coin-created-notification-alert-description">
          <h2>Coin created!</h2>
          <p>When token hits 800K stFUEL, it will become tradeable</p>
        </div>
      </div>
      <div className="created-token-card-wrapper">
        <div className="created-token-card" style={{ backgroundImage: `url(${token?.image || 'assets/default-token.png'})` }} />
      </div>
      <span className="created-token-ticker">{token?.ticker || '$NEW'}</span>
      <div className="coin-created-notification-action-buttons">
        <Button type="sell" label="View Coin" onClick={() => navigate(`/token/${token?.id || ''}`)} />
      </div>
    </div>
  )
}



