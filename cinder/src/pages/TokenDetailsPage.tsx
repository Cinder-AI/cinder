import React, { useState } from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '../components/Button'
import { AmountSelector } from '../components/AmountSelector'
import { BondingCurve } from '../components/BondingCurve'
import { TokenDetails } from '../components/TokenDetails'
import { Chart } from '../components/Chart'
import { toBaseUnits } from '../utils/index.ts'
import { useStore } from '../store/StoreProvider.jsx'
import { useWallet } from '@fuels/react'
import { useContracts } from '../hooks/useContracts.tsx'
import { reactorConfig } from '../config/reactor.ts'
import { swapExactInWithQuote } from '../modules/reactorDex.ts'

export function TokenDetailsPage() {
  const [amount, setAmount] = useState(0)
  const { id } = useParams()
  const { state } = useStore()
  const token = state.tokens.find(t => String(t.id) === id) || state.tokens[0]
  const { wallet } = useWallet()
  const { launchpad: launchpadContract, assets } = useContracts()
  const pledgeAssetId = assets?.fuelAssetId
  const isMigrated = String(token?.status || '').toLowerCase() === 'migrated'

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
      const { waitForResult } = await (launchpadContract.functions as any)
        .buy({ bits: token.id })
        .callParams({ forward: { assetId: pledgeAssetId, amount: budget as any } })
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
      const { waitForResult } = await (launchpadContract.functions as any)
        .sell({ bits: token.id }, amountInBaseUnits as any, 0)
        .callParams({ forward: { assetId: tokenAssetId, amount: amountInBaseUnits as any } })
        .txParams({ variableOutputs: 2 })
        .call();
      const result = await waitForResult();
      console.log("result", result.value);
    } catch (error) {
      console.error('Sell failed:', error);
      return false;
    }
  }

  const buyFromPool = async () => {
    if (!wallet?.provider) {
      console.error('Wallet is not ready');
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

    const tokenAssetId = token.assetId || token.id;
    if (!tokenAssetId) {
      console.error('Token asset id is missing:', token);
      return false;
    }

    const amountIn = toBaseUnits(String(amount * 100), 9);
    const poolId = [tokenAssetId, pledgeAssetId, reactorConfig.feeTier] as any;

    try {
      await swapExactInWithQuote({
        wallet,
        reactorPoolContractId: reactorConfig.reactorPoolContractId,
        poolId,
        tokenInId: pledgeAssetId,
        tokenOutId: tokenAssetId,
        amountIn,
        slippageBps: reactorConfig.defaultSlippageBps,
        deadlineBlocks: reactorConfig.deadlineBlocks,
      });
      return true;
    } catch (error) {
      console.error('Pool buy (swap) failed:', error);
      return false;
    }
  }

  const sellToPool = async () => {
    if (!wallet?.provider) {
      console.error('Wallet is not ready');
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

    const tokenAssetId = token.assetId || token.id;
    if (!tokenAssetId) {
      console.error('Token asset id is missing:', token);
      return false;
    }

    const amountIn = toBaseUnits(String(amount * 100), 9);
    const poolId = [tokenAssetId, pledgeAssetId, reactorConfig.feeTier] as any;

    try {
      await swapExactInWithQuote({
        wallet,
        reactorPoolContractId: reactorConfig.reactorPoolContractId,
        poolId,
        tokenInId: tokenAssetId,
        tokenOutId: pledgeAssetId,
        amountIn,
        slippageBps: reactorConfig.defaultSlippageBps,
        deadlineBlocks: reactorConfig.deadlineBlocks,
      });
      return true;
    } catch (error) {
      console.error('Pool sell (swap) failed:', error);
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
        <Button type="sell" label="Sell" onClick={isMigrated ? sellToPool : sell} />
        <Button type="buy" label="Buy" onClick={isMigrated ? buyFromPool : buy} />
      </div>
    </div>
  )
}



