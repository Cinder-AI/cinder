export const environments = {LOCAL: "local", TESTNET: "testnet", MAINNET: "mainnet"};
export const environment = environments.TESTNET;
export const isLocal = environment === environments.LOCAL;
export const isTestnet = environment === environments.TESTNET;
export const isMainnet = environment === environments.MAINNET;
console.log("isLocal", isLocal);
console.log("isTestnet", isTestnet);
console.log("isMainnet", isMainnet);

const PORT =  4000;

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
export const DEFAULT_SUB_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';