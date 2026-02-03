import { createConfig } from 'fuels';

export default createConfig({
  contracts: [
        '../contracts/launchpad',
        '../contracts/cinder',
        '../contracts/amm',
  ],
  output: './src/sway-api',
});

/**
 * Check the docs:
 * https://docs.fuel.network/docs/fuels-ts/fuels-cli/config-file/
 */
