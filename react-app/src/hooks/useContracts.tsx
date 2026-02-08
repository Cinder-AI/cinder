import React, { useState, useEffect } from 'react';
import { getContracts } from '../config/contracts';
import { useWallet } from '@fuels/react';
import { Launchpad } from '../sway-api/contracts/Launchpad';
import { Cinder } from '../sway-api/contracts/Cinder';
import { Fuel } from '../sway-api/contracts/Fuel';

export const useContracts = () => {
  const { wallet } = useWallet();
  const [contracts, setContracts] = useState<{ launchpad: Launchpad, cinder: Cinder, fuel: Fuel } | null>(null);

  useEffect(() => {
    if (!wallet) return;
    const init = async () => {
      const ids = await getContracts();
      const launchpad = new Launchpad(ids.LAUNCHPAD, wallet);
      const cinder = new Cinder(ids.CINDER, wallet);
      const fuel = new Fuel(ids.FUEL, wallet);
      setContracts({ launchpad, cinder, fuel });
    };
    init();
  }, [wallet]);

  return contracts;
};