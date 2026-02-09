import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { useWallet } from '@fuels/react'
import { TokenCard } from '../components/TokenCard.jsx'
import { AmountSelector } from '../components/AmountSelector.jsx'
import { useStore } from '../store/StoreProvider.jsx'
import { useBalance } from '../hooks/useBalance.tsx'
import { Button } from '../components/Button.jsx'
import { Match } from '../components/Match.tsx'
import { Airdrop } from '../components/Airdrop.tsx'

import { getContracts } from '../config/contracts.ts'
import { Cinder } from '../sway-api/contracts/Cinder.ts'
import { Launchpad } from '../sway-api/contracts/Launchpad.ts'
import { Fuel } from '../sway-api/contracts/Fuel.ts'

import { formatNumber, toBaseUnits } from '../utils/index.ts'

import { DollarIcon } from '../components/icons/DollarIcon.jsx'
import { CrossIcon } from '../components/icons/CrossIcon.jsx'



export function DiscoveryPage() {
  const { getTokens, addPledge, getToken, getTokenByName, launchCampaign } = useStore();
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [cinderContract, setContract] = useState(null);
  const [launchpadContract, setLaunchpadContract] = useState(null);
  const [fuelContract, setFuelContract] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [amount, setAmount] = useState(0);
  const tokens = useMemo(
    () => getTokens().filter(t => String(t.status || '').toLowerCase() === 'active'),
    [getTokens],
  );
  const { balances, loading, error } = useBalance();

  const [showAirdrop, setShowAirdrop] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchToken, setMatchToken] = useState(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [progressGlow, setProgressGlow] = useState(false);
  const progressIntervalRef = useRef(null);
  const matchTriggerRef = useRef(false);
  const matchTimeoutRef = useRef(null);

  const [sheetContent, setSheetContent] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pageContent = useRef(null);
  const layout = useRef(null);
  const buyButtonRef = useRef(null);
  const passButtonRef = useRef(null);
  const swipeControls = useMemo(() => ({ buy: buyButtonRef, pass: passButtonRef }), [buyButtonRef, passButtonRef]);
  
  const [balance, setBalance] = useState(250000);
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

  useEffect(() => {
    if (!wallet) return;

    let cancelled = false;

    (async () => {
      const ids = await getContracts();
      if (cancelled) return;

      setContract(new Cinder(ids.CINDER, wallet));
      setLaunchpadContract(new Launchpad(ids.LAUNCHPAD, wallet));
      setFuelContract(new Fuel(ids.FUEL, wallet));
    })().catch((e) => {
      console.error('Failed to init contracts:', e);
    });

    return () => {
      cancelled = true;
    };
  }, [wallet]);

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

    // Анимируем только токен с id 3: заполняем с 0 до фактического прогресса
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
          el.style.transform = ''
          el.style.opacity = ''
          el.style.transition = ''
          el.classList.remove('swiping-right', 'swiping-left')
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

    const assetBits = token.assetId || token.id;
    if (!assetBits) {
      console.error('Token asset id is missing:', token);
      return false;
    }

    const amountBefore = token.totalPledged;
    const progressBefore = token.progress;
    const baseAmount = toBaseUnits(amount);

    try {
      const baseAssetIdRaw = wallet.provider.getBaseAssetId?.();
      const baseAssetId = typeof baseAssetIdRaw === 'string' ? baseAssetIdRaw : (await baseAssetIdRaw) || '';
      console.log("baseAssetId", baseAssetId);
      if (!baseAssetId) throw new Error('Base asset id not available');

      const { waitForResult } = await launchpadContract.functions
        .pledge({ bits: assetBits }, baseAmount)
        .callParams({ forward: { assetId: "0x177bae7c37ea20356abd7fc562f92677e9861f09d003d8d3da3c259a9ded7dd8", amount: baseAmount } })
        .call();
      const res = await waitForResult();
      console.log("res", res);
    } catch (error) {
      console.error('Pledge failed:', error);
      return false;
    }

    // Вычисляем новые значения ЛОКАЛЬНО, не полагаясь на стейт
    setBalance(prev => prev - amount);
    const newTotalPledged = amountBefore + amount;
    const newProgress = Math.round((newTotalPledged / token.target) * 100);
    
    // Обновляем стейт
    addPledge(tokenId, amount);
    
    // Проверяем на ВЫЧИСЛЕННОМ прогрессе
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


  const handleMatch = () => {
    if (showMatch) {
      return (
        <Match token={tokens[currentIndex]} />
      )
    }
    return null;
  }

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
          balance={`${formatNumber(balance)} stFUEL`}
          onAmountChange={(amount) => setAmount(amount)}
          amount={amount}
          minRange={0}
          maxRange={250000}
          showButtons={true}
        />
        <div className="action-buttons">
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
        container={pageContent.current}
      />
      <Airdrop
        open={showAirdrop}
        dead={deadToken}
        living={livingToken}
        onClose={handleAirdropClose}
        container={layout.current}
      />
    </div>
  )
}