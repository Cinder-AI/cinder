export const environments = {LOCAL: "local", TESTNET: "testnet", MAINNET: "mainnet"};
export const environment = import.meta.env.VITE_DAPP_ENVIRONMENT || environments.LOCAL;
export const isLocal = environment === environments.LOCAL;
export const isTestnet = environment === environments.TESTNET;
export const isMainnet = environment === environments.MAINNET;

const PORT = import.meta.env.VITE_FUEL_NODE_PORT || 4000;

console.log(`Environment: ${environment}`);
console.log(`Port: ${PORT}`);
export const localProviderUrl = `http://127.0.0.1:${PORT}/v1/graphql`;
export const testnetProviderUrl = "https://testnet.fuel.network/v1/graphql";
export const mainnetProviderUrl = "https://mainnet.fuel.network/v1/graphql";
export const providerUrl = isLocal ? localProviderUrl : (isMainnet ? mainnetProviderUrl : testnetProviderUrl);

export const localChainId = 0;
export const testnetChainId = 0;
export const mainnetChainId = 0;
export const providerChainId = isLocal ? localChainId : (isMainnet ? mainnetChainId : testnetChainId);
