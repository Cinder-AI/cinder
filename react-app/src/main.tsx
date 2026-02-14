import  React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { defaultConnectors, FuelWalletConnector } from '@fuels/connectors'
import { FuelProvider, NetworkConfig } from '@fuels/react'
import { FuelConnector, Provider } from "fuels"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './index.css'
import App from './App.tsx'
import { StoreProvider } from './store/StoreProvider.jsx'
import { ContractsProvider } from './hooks/useContracts.tsx'
import { providerUrl, providerChainId } from './lib.tsx'

const queryClient = new QueryClient();
const connectors: FuelConnector[] = defaultConnectors({
  devMode: true,
  fuelProvider: new Provider(providerUrl),
  chainId: providerChainId
});

let conns: FuelConnector[] = [];
connectors.map((c, i) => {
  if (i !== 1) {
    conns.push(c);
  }
})

// const connectors: FuelConnector[] = [
//   new FuelWalletConnector()
// ];
console.log("connectors", conns);
const networks: NetworkConfig[] = [{ url: providerUrl, chainId: providerChainId } as NetworkConfig];

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found')
}
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FuelProvider theme='dark' networks={networks} fuelConfig={{ connectors }}>
        <ContractsProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </ContractsProvider>
      </FuelProvider>
    </QueryClientProvider>
  </StrictMode>,
)
