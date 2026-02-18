import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBalance } from '../hooks/useBalance'
import { useContracts } from '../hooks/useContracts'
import { useWallet } from '@fuels/react'

import { TokenCard } from '../components/TokenCard'
import { AmountSelector } from '../components/AmountSelector'
import { useStore } from '../store/StoreProvider'
import { Button } from '../components/Button'
import { Match } from '../components/Match'
import { Airdrop } from '../components/Airdrop'
import { BottomSheet } from '../components/BottomSheet'
import { DollarIcon } from '../components/icons/DollarIcon'
import { CrossIcon } from '../components/icons/CrossIcon'

import { formatNumber, toBaseUnits } from '../utils/index.ts'

export function DiscoveryPage() {
  const { getTokens, addPledge, getToken, getTokenByName, launchCampaign } = useStore();
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { launchpad: launchpadContract, assets } = useContracts();
  const { getAmount } = useBalance();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [amount, setAmount] = useState(0);
  const tokens = useMemo(
    () => getTokens().filter(t => String(t.status || '').toLowerCase() === 'active'),
    [getTokens],
  );

  const fuelBalance = useMemo(
    () => getAmount(assets?.fuelAssetId),
    [getAmount, assets?.fuelAssetId]
  );
  
  const cinderBalance = useMemo(
    () => getAmount(assets?.cinderAssetId),
    [getAmount, assets?.cinderAssetId]
  );

  const [showAirdrop, setShowAirdrop] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchToken, setMatchToken] = useState(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [progressGlow, setProgressGlow] = useState(false);
  const progressIntervalRef = useRef(null);
  const matchTriggerRef = useRef(false);
  const matchTimeoutRef = useRef(null);

  const pageContent = useRef(null);
  const layout = useRef(null);
  const buyButtonRef = useRef(null);
  const passButtonRef = useRef(null);
  const swipeControls = useMemo(() => ({ buy: buyButtonRef, pass: passButtonRef }), [buyButtonRef, passButtonRef]);
  
  const maxPledgeAmount = Math.max(0, Math.floor(fuelBalance));
  const deadToken = getTokenByName('BERT');
  const livingToken = getTokenByName('WaiFU');

  useEffect(() => {
    setTimeout(() => {
      setShowAirdrop(false);
    }, 3000);
    setCurrentIndex(0);
    if (tokens.length > 0) {
      setMatchToken(tokens[0]); // ← Устанавливаем первый токен для дебага
    }
  }, [tokens.length]);

  useLayoutEffect(() => {
    const currentToken = tokens[currentIndex];
    if (!currentToken) {
      setDisplayProgress(0);
      setProgressGlow(false);
      matchTriggerRef.current = false;
      return () => {};
    }

    const base = Math.round(currentToken.progress ?? 0);

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    matchTriggerRef.current = false;

    // Animate only token with id 3: fill from 0 to actual progress
    if (currentToken.id !== 3) {
      setDisplayProgress(base);
      setProgressGlow(base >= 80);
      return () => {};
    }

    const target = Math.max(base, 80);

    setDisplayProgress(0);
    setProgressGlow(target >= 80);

    if (target <= 0) return () => {};

    const step = Math.max(1, Math.ceil(target / 60));

    progressIntervalRef.current = setInterval(() => {
      setDisplayProgress(prev => {
        const next = Math.min(prev + step, target);
        if (next >= 80) setProgressGlow(true);
        if (next === target && progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        return next;
      });
    }, 8);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (matchTimeoutRef.current) {
        clearTimeout(matchTimeoutRef.current);
        matchTimeoutRef.current = null;
      }
    };
  }, [currentIndex, tokens]);

  useEffect(() => {
    const currentToken = tokens[currentIndex];
    if (!currentToken || currentToken.id !== 3) return;

    if (displayProgress >= 80 && !matchTriggerRef.current) {
      matchTriggerRef.current = true;
      if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = setTimeout(() => {
        setMatchToken(currentToken);
        setShowMatch(true);
      }, 1300);
    }

    return () => {
      if (matchTimeoutRef.current) {
        clearTimeout(matchTimeoutRef.current);
        matchTimeoutRef.current = null;
      }
    };
  }, [displayProgress, currentIndex, tokens]);

  const next = () => {
    setCurrentIndex(i => {
      if (!tokens.length) return 0
      const newIndex = (i + 1) % tokens.length
      // Reset any lingering styles on cards after a small delay
      setTimeout(() => {
        document.querySelectorAll('.token-card-wrapper').forEach(el => {
          const node = el as HTMLElement
          node.style.transform = ''
          node.style.opacity = ''
          node.style.transition = ''
          node.classList.remove('swiping-right', 'swiping-left')
        })
      }, 50)
      return newIndex
    })
  }

  // Helper to get next token with wraparound
  const getNextToken = () => {
    if (!tokens.length) return null
    const nextIdx = (currentIndex + 1) % tokens.length
    return tokens[nextIdx]
  }

  const pledge = async (tokenId, amount) => {
    const token = getToken(tokenId);
    if (!token) {
      console.error('Token not found for pledge:', tokenId);
      return false;
    }
    if (!launchpadContract || !wallet?.provider) {
      console.error('Launchpad contract or wallet is not ready');
      return false;
    }
    if (!amount || amount <= 0) {
      console.error('Invalid pledge amount:', amount);
      return false;
    }
    if (!assets?.fuelAssetId) {
      console.error('Fuel asset id is not ready');
      return false;
    }
    if (amount > fuelBalance) {
      console.error('Insufficient fuel balance:', { amount, fuelBalance });
      return false;
    }

    const assetBits = token.assetId || token.id;
    if (!assetBits) {
      console.error('Token asset id is missing:', token);
      return false;
    }

    const amountBefore = token.totalPledged;
    const progressBefore = token.progress;
    const decimalizedAmount = toBaseUnits(amount);

    try {
      const baseAssetIdRaw = wallet.provider.getBaseAssetId?.();
      const baseAssetId = typeof baseAssetIdRaw === 'string' ? baseAssetIdRaw : (await baseAssetIdRaw) || '';
      console.log("baseAssetId", baseAssetId);
      if (!baseAssetId) throw new Error('Base asset id not available');

      const { waitForResult } = await (launchpadContract.functions as any)
        .pledge({ bits: assetBits }, decimalizedAmount as any)
        .callParams({ forward: { assetId: assets.fuelAssetId, amount: decimalizedAmount as any } })
        .call();
      const res = await waitForResult();
      console.log("res", res);
    } catch (error) {
      console.error('Pledge failed:', error);
      return false;
    }

    // Calculate new values locally, not relying on state
    const newTotalPledged = amountBefore + amount;
    const newProgress = Math.round((newTotalPledged / token.target) * 100);
    
    // Update state
    addPledge(tokenId, amount);
    
    // Check calculated progress
    if (newProgress >= 80 && progressBefore < 80) {
      console.log("Launching campaign!");
      launchCampaign(tokenId);
      setMatchToken(token);
      const timer = setTimeout(() => {
        setShowMatch(true);
      }, 1000);
      return true;
    }
    return true;
  }

  const handlePledge = async () => {
    const currentToken = tokens[currentIndex];
    if (currentToken) { 
      const ok = await pledge(currentToken.id, amount);
      if (ok) next();
    }
  }

  const handleTrade = () => {
    console.log("trading");
    navigate(`/token/${matchToken.id}`);
    setShowMatch(false);
  }

  const handleKeepSwiping = () => {
    setShowMatch(false);
  }


  // match rendering handled inline below

  const handleAirdropClose = () => {
    setShowAirdrop(false);
  }

  const currentToken = tokens[currentIndex];
  const nextToken = getNextToken();

  return (
    <div className="discovery-page">
      <div className="cards-stack">
        {nextToken && (
          <div className="next-card" key={`next-${currentIndex}`}>
            <TokenCard
              {...nextToken}
              media={nextToken.media}
              glow={false}
              controlsRef={swipeControls}
              isPreview
              onSwipeLeft={() => {}}
              onSwipeRight={() => {}}
            />
          </div>
        )}
        {currentToken && (
          <div className="current-card" key={`current-${currentIndex}`}>
            <TokenCard
              {...currentToken}
              media={currentToken.media}
              progress={displayProgress}
              glow={progressGlow}
              controlsRef={swipeControls}
              isPreview={false}
              onSwipeLeft={next}
              onSwipeRight={handlePledge}
            />
          </div>
        )}
      </div>
      <div className="discovery-page-bottom-buttons">
        <AmountSelector
          balance={`${formatNumber(fuelBalance)} FUEL`}
          onAmountChange={setAmount}
          amount={amount}
        />

        <div className="discovery-action-buttons">
          <Button ref={passButtonRef} unstyled className="action-btn pass-btn" onClick={() => next()}><CrossIcon /></Button>
          <Button ref={buyButtonRef} unstyled className="action-btn buy-btn" onClick={handlePledge}><DollarIcon /></Button>
        </div>
      </div>

      <Match
        open={showMatch}
        token={matchToken}
        onClose={() => setShowMatch(false)}
        onTradeNow={handleTrade}
        onKeepSwiping={handleKeepSwiping}
        container={layout.current}
      />

      <Airdrop content={null} open={showAirdrop} dead={deadToken} living={livingToken} onClose={handleAirdropClose} />

      <BottomSheet open={showMatch} onClose={() => setShowMatch(false)}>
        {matchToken && (
          <div className="match-sheet-content">
              <div className="match-sheet-token">
                      <TokenCard {...matchToken} />
                    </div>
            <div className="match-sheet-actions">
              <div className="match-sheet-buttons">
                <Button type="buy" onClick={handleTrade}>Trade now</Button>
                <Button type="sell" onClick={handleKeepSwiping}>Keep Swiping</Button>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}