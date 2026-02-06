import React, { useState, useEffect } from 'react';
import { getContracts } from '../config/contracts';
import { useWallet } from '@fuels/react';
import { Launchpad } from '../sway-api/contracts/Launchpad';
import { Cinder } from '../sway-api/contracts/Cinder';

export const useContracts = () => {
  const { wallet } = useWallet();
  const [contracts, setContracts] = useState<{ launchpad: Launchpad, cinder: Cinder } | null>(null);

  useEffect(() => {
    if (!wallet) return;
    const init = async () => {
      const ids = await getContracts();
      const launchpad = new Launchpad(ids.LAUNCHPAD, wallet);
      const cinder = new Cinder(ids.CINDER, wallet);
      setContracts({ launchpad, cinder });
    };
    init();
  }, [wallet]);

  return contracts;
};