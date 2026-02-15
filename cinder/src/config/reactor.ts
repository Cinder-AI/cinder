import { FeeAmount } from 'reactor-sdk-ts';

const feeFromEnv = Number(import.meta.env.VITE_REACTOR_POOL_FEE || FeeAmount.MEDIUM);

export const reactorConfig = {
  reactorPoolContractId:
    import.meta.env.VITE_REACTOR_POOL_CONTRACT_ID ||
    '0xa5843e9c21e5039d527b25b45c8f3c28ca33258ae52e6350764024ef24831966',
  feeTier: feeFromEnv as FeeAmount,
  defaultSlippageBps: Number(import.meta.env.VITE_REACTOR_SLIPPAGE_BPS || 100),
  deadlineBlocks: Number(import.meta.env.VITE_REACTOR_DEADLINE_BLOCKS || 1000),
};
