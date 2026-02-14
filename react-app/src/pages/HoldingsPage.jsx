import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@fuels/react'
import { Button } from '../components/Button.jsx'
import { useStore } from '../store/StoreProvider.jsx'
import { useBalance } from '../hooks/useBalance.tsx'
import { indexerGraphQL } from '../services/indexerGraphQL.ts'
import { formatNumber, fromBaseUnits } from '../utils/index.js'
import { useContracts } from '../hooks/useContracts.tsx'

export function HoldingsPage() {
  const contracts = useContracts()
  const launchpadContract = contracts?.launchpad
  const { getTokenByAssetId, getTokenByName, getTokenByTicker } = useStore()
  const { balances, loading, error, refetch } = useBalance()
  const { wallet } = useWallet()
  const navigate = useNavigate()
  const [pledges, setPledges] = useState([])
  const [pledgeLoading, setPledgeLoading] = useState(false)
  const [pledgeError, setPledgeError] = useState(null)

  const loadPledges = useCallback(async () => {
    if (!wallet) {
      setPledges([])
      return
    }
    try {
      setPledgeLoading(true)
      setPledgeError(null)
      const userId = wallet.address?.toB256?.() || wallet.address?.toString?.() || ''
      const rows = await indexerGraphQL.getUserPledges(userId)
      setPledges(rows)
    } catch (err) {
      setPledgeError(err)
    } finally {
      setPledgeLoading(false)
    }
  }, [wallet])

  useEffect(() => {
    loadPledges()
  }, [loadPledges])

  const tokens = useMemo(() => {
    const rows = new Map()

    balances.forEach((balance) => {
      const decimals = balance.metadata?.decimals ?? 9
      const amount = fromBaseUnits(balance.amount || 0, decimals)
      if (!amount) return
      const byAsset = getTokenByAssetId(balance.assetId)
      const byTicker = balance.metadata?.symbol ? getTokenByTicker(balance.metadata.symbol) : null
      const byName = balance.metadata?.name ? getTokenByName(balance.metadata.name) : null
      const token = byAsset || byTicker || byName
      if (!token) return
      const key = token.assetId || token.id
      rows.set(key, { ...token, amount })
    })

    pledges.forEach((pledge) => {
      const pledgedAmount = Number(pledge.amount || 0)
      if (!pledgedAmount) return
      const token = getTokenByAssetId(pledge.campaign_id)
      if (!token) return
      const key = token.assetId || token.id
      const existing = rows.get(key)
      if (existing) {
        rows.set(key, { ...existing, pendingPledge: pledge.amount })
      } else {
        rows.set(key, { ...token, amount: 0, pendingPledge: pledge.amount, canSell: false })
      }
    })

    return Array.from(rows.values())
  }, [balances, pledges, getTokenByAssetId, getTokenByName, getTokenByTicker])
  const claim = async (token) => {
    console.log('yo');
    if (!launchpadContract || !token?.assetId) return
    try {
      const status = String(token.status || '').toLowerCase()
      if (status === 'launched') {
        await launchpadContract.functions.claim({ bits: token.assetId }).call()
      } else if (status === 'denied') {
        await launchpadContract.functions.refund_pledge({ bits: token.assetId }).call()
      }
      await Promise.all([refetch(), loadPledges()])
    } catch (err) {
      console.error('Claim failed:', err)
    }
  }

  const resolveAction = (token) => {
    const amount = Number(token.amount || 0)
    const pledged = Number(token.pendingPledge || 0)
    const status = (token.status || '').toLowerCase()
    const hasBalance = amount > 0
    const hasPledge = pledged > 0

    if (hasBalance) {
      return { label: 'Sell', type: 'sell', disabled: false }
    }

    if (hasPledge) {
      const disabled = status === 'active'
      return { label: 'Claim', type: 'buy', disabled }
    }

    return { label: 'Sell', type: 'sell', disabled: true }
  }

  if (loading || pledgeLoading) {
    return (
      <div className="holdings-page">
        <h1>Holdings</h1>
        <div className="holdings-table">Loading holdings...</div>
      </div>
    )
  }

  if (error || pledgeError) {
    return (
      <div className="holdings-page">
        <h1>Holdings</h1>
        <div className="holdings-table">Failed to load balances.</div>
      </div>
    )
  }

  return (
    <div className="holdings-page">
      <h1>Holdings</h1>
      <div className="holdings-table">
        {tokens.map(token => (
          <div
            key={token.assetId || token.id}
            className="holdings-table-row"
            onClick={() => {
              if (token.id) navigate(`/token/${token.id}`)
            }}
          >
            <div className="holdings-token-picture"><img src={token.image} alt={token.name} /></div>
            <div className="holdings-token-info">
              <h3 className="holdings-token-name">{token.name}</h3>
              <div className="holdings-token-amount-value">
                {(() => {
                  const amount = Number(token.amount || 0)
                  const label = `${formatNumber(amount)} ${token.ticker || token.name}`
                  if (amount > 0) return label
                  if (!token.pendingPledge) return label
                  const pledged = formatNumber(Number(token.pendingPledge || 0))
                  return `pledged ${pledged} stFUEL`
                })()}
              </div>
            </div>
            <div className="holdings-sell-button">
              {(() => {
                const action = resolveAction(token)
                return (
                  <Button
                    type={action.type}
                    label={action.label}
                    disabled={action.disabled}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (action.label === 'Claim') {
                        claim(token)
                      } else {
                        /* sell flow */
                      }
                    }}
                  />
                )
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

