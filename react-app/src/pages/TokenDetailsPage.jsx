import React, { useState } from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '../components/Button.jsx'
import { AmountSelector } from '../components/AmountSelector.jsx'
import { BondingCurve } from '../components/BondingCurve.jsx'
import { TokenDetails } from '../components/TokenDetails.tsx'
import { Chart } from '../components/Chart.tsx'
import { toBaseUnits } from '../utils/index.js'
import { useStore } from '../store/StoreProvider.jsx'
import { useWallet } from '@fuels/react'
import { useContracts } from '../hooks/useContracts.tsx'

export function TokenDetailsPage() {
  const [amount, setAmount] = useState(0)
  const { id } = useParams()
  const { state } = useStore()
  const token = state.tokens.find(t => String(t.id) === id) || state.tokens[0]
  const { wallet } = useWallet()
  const { launchpad: launchpadContract, assets } = useContracts()
  const pledgeAssetId = assets?.fuelAssetId

  if (!token) {
    return <div>Token not found</div>
  }

  const buy = async () => {
    if (!launchpadContract || !wallet?.provider) {
      console.error('Launchpad contract or wallet is not ready');
      return false;
    }
    if (!amount || amount <= 0) {
      console.error('Invalid amount:', amount);
      return false;
    }
    if (!pledgeAssetId) {
      console.error('Pledge asset id is not ready');
      return false;
    }
    const budget = toBaseUnits(String(amount * 100), 9);

    try {
      const { waitForResult } = await launchpadContract.functions
        .buy({ bits: token.id })
        .callParams({ forward: { assetId: pledgeAssetId, amount: budget } })
        .txParams({ variableOutputs: 2 })
        .call();
      
      const result = await waitForResult();
      console.log("result", result.value);
    } catch (error) {
      console.error('Buy failed:', error);
      return false;
    }
  }

  const sell = async () => {
    if (!launchpadContract || !wallet?.provider) {
      console.error('Launchpad contract or wallet is not ready');
      return false;
    }
    if (!amount || amount <= 0) {
      console.error('Invalid amount:', amount);
      return false;
    }
    const tokenAssetId = token.assetId || token.id;
    if (!tokenAssetId) {
      console.error('Token asset id is missing:', token);
      return false;
    }
    const amountInBaseUnits = toBaseUnits(String(amount * 100), 9);

    try {
      const { waitForResult } = await launchpadContract.functions
        .sell({ bits: token.id }, amountInBaseUnits, 0)
        .callParams({ forward: { assetId: tokenAssetId, amount: amountInBaseUnits } })
        .txParams({ variableOutputs: 2 })
        .call();
      const result = await waitForResult();
      console.log("result", result.value);
    } catch (error) {
      console.error('Sell failed:', error);
      return false;
    }
  }

  return (
    <div className="token-details-page">
      <TokenDetails token={token} />

      <Chart token={token} />

      <div className="token-details-slider">
        <AmountSelector balance={'250k FUEL'} showButtons={false} tokenName={'FUEL'} onAmountChange={setAmount} />
      </div>

      <div className="token-details-action-buttons">
        <Button type="sell" label="Sell" onClick={sell} />
        <Button type="buy" label="Buy" onClick={buy} />
      </div>
    </div>
  )
}



