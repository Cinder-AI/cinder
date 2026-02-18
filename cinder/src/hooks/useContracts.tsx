import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWallet } from '@fuels/react';
import { CONTRACT_ADDRESSES, ENVIRONMENT, type ContractIds, type LocalRegistry } from '../config';
import { Launchpad } from '../sway-api/contracts/Launchpad';
import { Cinder } from '../sway-api/contracts/Cinder';
import { Fuel } from '../sway-api/contracts/Fuel';
import { toAssetIdString } from '../utils/index';

type AppContracts = {
  launchpad: Launchpad;
  cinder: Cinder;
  fuel: Fuel;
};

type ContractAssets = {
  fuelAssetId: string;
  cinderAssetId: string;
};

type ContractsContextValue = {
  contracts: AppContracts | null;
  assets: ContractAssets | null;
  launchpad: Launchpad | null;
  cinder: Cinder | null;
  fuel: Fuel | null;
  initialized: boolean;
};

const ContractsContext = createContext<ContractsContextValue | null>(null);

/**
 * Validates that contract IDs are not empty
 */
function assertNonEmpty(ids: ContractIds, hint: string): void {
  const empty = Object.entries(ids).filter(([, v]) => !v);
  if (empty.length === 0) return;
  const keys = empty.map(([k]) => k).join(', ');
  throw new Error(`${hint}: empty contract id for ${keys}`);
}

/**
 * Loads contract addresses from local JSON file
 * Only used in local environment
 */
async function loadLocalContracts(): Promise<ContractIds> {
  const res = await fetch('/fuel-contracts.local.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(
      'Not found /fuel-contracts.local.json. Run ./scripts/deploy_contracts.sh (it writes to react-app/public).'
    );
  }

  const json = (await res.json()) as LocalRegistry;

  const get = (name: 'cinder' | 'launchpad' | 'fuel') => {
    const id = json.contracts?.[name]?.contract_id;
    if (!id) throw new Error(`No contract_id for "${name}" in registry`);
    return id;
  };

  return {
    CINDER: get('cinder'),
    LAUNCHPAD: get('launchpad'),
    FUEL: get('fuel'),
  };
}

// Cache for contract IDs
let contractIdsCache: Promise<ContractIds> | null = null;

/**
 * Gets contract addresses based on current environment
 * - local: loads from /fuel-contracts.local.json
 * - testnet/mainnet: returns from CONTRACT_ADDRESSES config
 */
export function getContractIds(): Promise<ContractIds> {
  if (contractIdsCache) return contractIdsCache;

  contractIdsCache = (async () => {
    if (ENVIRONMENT === 'local') return await loadLocalContracts();
    if (ENVIRONMENT === 'testnet') return CONTRACT_ADDRESSES.testnet;
    if (ENVIRONMENT === 'mainnet') {
      assertNonEmpty(CONTRACT_ADDRESSES.mainnet, 'MAINNET addresses not filled');
      return CONTRACT_ADDRESSES.mainnet;
    }
    throw new Error(`Unknown environment: ${ENVIRONMENT}`);
  })();

  return contractIdsCache;
}

export function ContractsProvider({ children }: { children: ReactNode }) {
  const { wallet } = useWallet();
  const [contracts, setContracts] = useState<AppContracts | null>(null);
  const [assets, setAssets] = useState<ContractAssets | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setContracts(null);
      setAssets(null);
      setInitialized(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const ids = await getContractIds();
        if (cancelled) return;

        const launchpad = new Launchpad(ids.LAUNCHPAD, wallet);
        const cinder = new Cinder(ids.CINDER, wallet);
        const fuel = new Fuel(ids.FUEL, wallet);
        const fuelAssetId = toAssetIdString(ids.FUEL);
        const cinderAssetId = toAssetIdString(ids.CINDER);

        setContracts({ launchpad, cinder, fuel });
        setAssets({ fuelAssetId, cinderAssetId });
        setInitialized(true);
      } catch (error) {
        console.error('Failed to init contracts:', error);
        if (!cancelled) {
          setContracts(null);
          setAssets(null);
          setInitialized(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const value = useMemo(
    () => ({
      contracts,
      assets,
      launchpad: contracts?.launchpad || null,
      cinder: contracts?.cinder || null,
      fuel: contracts?.fuel || null,
      initialized,
    }),
    [contracts, assets, initialized],
  );

  return <ContractsContext.Provider value={value}>{children}</ContractsContext.Provider>;
}

export const useContracts = () => {
  const ctx = useContext(ContractsContext);
  if (!ctx) {
    throw new Error('useContracts must be used within ContractsProvider');
  }
  return ctx;
};
