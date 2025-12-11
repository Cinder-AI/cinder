import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button.jsx'
import { useStore } from '../store/StoreProvider.jsx'
import { formatNumber } from '../utils/index.js'

export function HoldingsPage() {
  const { getUserHoldings } = useStore()
  const navigate = useNavigate()
  const tokens = getUserHoldings().filter(t => t.id !== 1 && t.id !== 2)

  return (
    <div className="holdings-page">
      <h1>Holdings</h1>
      <div className="holdings-table">
        {tokens.map(token => (
          <div key={token.id} className="holdings-table-row" onClick={() => navigate(`/token/${token.id}`)}>
            <div className="holdings-token-picture"><img src={token.image} alt={token.name} /></div>
            <div className="holdings-token-info">
              <h3 className="holdings-token-name">{token.name}</h3>
              <div className="holdings-token-amount-value">{formatNumber(token.amount)} - {formatNumber(token.value)} USD</div>
            </div>
            <div className="holdings-sell-button">
              <Button type="sell" label="Sell" disabled={!token.canSell} onClick={(e) => { e.stopPropagation(); /* sell flow */ }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

