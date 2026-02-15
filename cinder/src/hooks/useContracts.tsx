import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWallet } from '@fuels/react';
import { getContracts } from '../config/contracts';
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
        const ids = await getContracts();
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