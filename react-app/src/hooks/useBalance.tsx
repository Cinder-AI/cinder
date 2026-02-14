import { useMemo } from 'react';
import { useWallet } from '@fuels/react';
import { useQuery } from '@tanstack/react-query';
import { TokenInfoOutput } from '../sway-api/contracts/Launchpad';
import { fuelGraphQL } from '../services/fuelGraphQL';
import { useContracts } from './useContracts';

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
  const { launchpad, cinder, assets, initialized } = useContracts();
  const walletAddress = wallet?.address?.toString() || '';

  const launchpadAssetsQuery = useQuery({
    queryKey: ['launchpad-assets', launchpad?.id?.toString?.() || 'none'],
    enabled: Boolean(launchpad),
    staleTime: 60_000,
    queryFn: async () => {
      if (!launchpad) return new Map<string, TokenInfoOutput>();
      const assetsRes = await launchpad.functions.get_assets().get();
      const tokensMap = new Map<string, TokenInfoOutput>();
      assetsRes.value.forEach((token) => {
        tokensMap.set(token.asset_id.bits, token);
      });
      return tokensMap;
    },
  });

  const balancesQuery = useQuery({
    queryKey: ['wallet-balances', walletAddress, launchpadAssetsQuery.dataUpdatedAt],
    enabled: Boolean(walletAddress && initialized && launchpadAssetsQuery.data),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<EnrichedBalance[]> => {
      if (!walletAddress) return [];
      const rawBalances = await fuelGraphQL.getBalances(walletAddress);
      const launchpadTokens = launchpadAssetsQuery.data || new Map<string, TokenInfoOutput>();
      const cinderAssetId = assets?.cinderAssetId || null;
      const enriched: EnrichedBalance[] = [];

      for (const balance of rawBalances) {
        const { assetId, amount } = balance;

        if (cinder && cinderAssetId && assetId === cinderAssetId) {
          const [nameRes, symbolRes, decimalsRes] = await Promise.all([
            cinder.functions.name({ bits: assetId }).get(),
            cinder.functions.symbol({ bits: assetId }).get(),
            cinder.functions.decimals({ bits: assetId }).get(),
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

        enriched.push({ assetId, amount, source: 'other' });
      }

      return enriched;
    },
  });

  const balances = balancesQuery.data || [];
  const ourTokens = useMemo(() => balances.filter((b) => b.source !== 'other'), [balances]);
  const otherTokens = useMemo(() => balances.filter((b) => b.source === 'other'), [balances]);

  return {
    balances,
    ourTokens,
    otherTokens,
    loading: balancesQuery.isLoading || launchpadAssetsQuery.isLoading,
    error: (balancesQuery.error as Error | null) || (launchpadAssetsQuery.error as Error | null),
    refetch: balancesQuery.refetch,
    initialized: initialized && Boolean(launchpadAssetsQuery.data),
  };
};