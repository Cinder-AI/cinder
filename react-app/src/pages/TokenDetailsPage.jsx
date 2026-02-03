import { Button } from '../components/Button.jsx'
import { AmountSelector } from '../components/AmountSelector.jsx'
import { BondingCurve } from '../components/BondingCurve.jsx'
import { formatNumber } from '../utils/index.js'
import { useParams } from 'react-router-dom'
import { useStore } from '../store/StoreProvider.jsx'
import { TokenDetails } from '../components/TokenDetails.tsx'
import { Chart } from '../components/Chart.tsx'

export function TokenDetailsPage() {
  const { id } = useParams()
  const { state } = useStore()
  const token = state.tokens.find(t => String(t.id) === id) || state.tokens[0]

  if (!token) {
    return <div>Token not found</div>
  }


  return (
    <div className="token-details-page">
      <TokenDetails token={token} />

      <Chart token={token} />

      <div className="token-details-slider">
        <AmountSelector balance={'250k stFUEL'} showButtons={false} tokenName={'stFUEL'} onAmountChange={() => {}} />
      </div>

      <div className="token-details-action-buttons">
        <Button type="sell" label="Sell" onClick={() => {}} />
        <Button type="buy" label="Buy" onClick={() => {}} />
      </div>
    </div>
  )
}



