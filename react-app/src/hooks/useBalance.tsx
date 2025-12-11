// react-app/src/hooks/useBalance.tsx

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@fuels/react';
import { Cinder } from '../sway-api/contracts/Cinder';
import { Launchpad, TokenInfoOutput } from '../sway-api/contracts/Launchpad';
import { fuelGraphQL } from '../services/fuelGraphQL';
import { CONTRACTS } from '../config/contracts';

interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  description?: string;
  image?: string;
}

interface EnrichedBalance {
  assetId: string;
  amount: string;
  source: 'cinder' | 'launchpad' | 'other';
  metadata?: TokenMetadata;
}

export const useBalance = () => {
  const { wallet } = useWallet();
  const [balances, setBalances] = useState<EnrichedBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [launchpadTokens, setLaunchpadTokens] = useState<Map<string, TokenInfoOutput>>(new Map());
  const [cinderAssetId, setCinderAssetId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Инициализация контрактов
  useEffect(() => {
    if (!wallet) return;

    const init = async () => {
      try {
        const cinderContract = new Cinder(CONTRACTS.CINDER, wallet);
        const launchpadContract = new Launchpad(CONTRACTS.LAUNCHPAD, wallet);

        const [assetsRes, cinderAssetRes] = await Promise.all([
          launchpadContract.functions.get_assets().get(),
          cinderContract.functions.default_asset().get(),
        ]);

        const tokensMap = new Map<string, TokenInfoOutput>();
        assetsRes.value.forEach(token => {
          tokensMap.set(token.asset_id.bits, token);
        });

        setLaunchpadTokens(tokensMap);
        setCinderAssetId(cinderAssetRes.value.bits);
        setInitialized(true);
        
        console.log('Contracts initialized:', {
          launchpadTokensCount: tokensMap.size,
          cinderAssetId: cinderAssetRes.value.bits,
        });
      } catch (err) {
        console.error('Error initializing contracts:', err);
        setError(err as Error);
      }
    };

    init();
  }, [wallet]);

  // Получение и обогащение балансов
  const fetchBalances = useCallback(async () => {
    if (!wallet || !initialized) {
      console.log('Waiting for initialization...', { wallet: !!wallet, initialized });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rawBalances = await fuelGraphQL.getBalances(wallet.address.toString());
      console.log('Raw balances from GraphQL:', rawBalances);

      const enriched: EnrichedBalance[] = [];
      const cinderContract = new Cinder(CONTRACTS.CINDER, wallet);

      for (const balance of rawBalances) {
        const { assetId, amount } = balance;

        // Проверка Cinder токена
        if (cinderAssetId && assetId === cinderAssetId) {
          const [nameRes, symbolRes, decimalsRes] = await Promise.all([
            cinderContract.functions.name({ bits: assetId }).get(),
            cinderContract.functions.symbol({ bits: assetId }).get(),
            cinderContract.functions.decimals({ bits: assetId }).get(),
          ]);

          enriched.push({
            assetId,
            amount,
            source: 'cinder',
            metadata: {
              name: nameRes.value || 'Unknown',
              symbol: symbolRes.value || 'UNK',
              decimals: decimalsRes.value || 9,
            },
          });
          continue;
        }

        // Проверка Launchpad токена
        const launchpadToken = launchpadTokens.get(assetId);
        if (launchpadToken) {
          enriched.push({
            assetId,
            amount,
            source: 'launchpad',
            metadata: {
              name: launchpadToken.name,
              symbol: launchpadToken.ticker,
              decimals: 9,
              description: launchpadToken.description,
              image: launchpadToken.image,
            },
          });
          continue;
        }

        // Остальные токены
        enriched.push({ assetId, amount, source: 'other' });
      }

      console.log('Enriched balances:', enriched);
      setBalances(enriched);
    } catch (err) {
      console.error('Error fetching balances:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [wallet, launchpadTokens, cinderAssetId, initialized]);

  useEffect(() => {
    if (initialized) {
      fetchBalances();
    }
  }, [initialized, fetchBalances]);

  const ourTokens = balances.filter(b => b.source !== 'other');
  const otherTokens = balances.filter(b => b.source === 'other');

  return {
    balances,
    ourTokens,
    otherTokens,
    loading,
    error,
    refetch: fetchBalances,
    initialized,
  };
};