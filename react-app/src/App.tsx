import React from 'react'
import { useConnectUI, useIsConnected, useNetwork, useBalance, useAccount, useWallet } from "@fuels/react";
import { useEffect } from 'react'

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { ROUTES, getHeaderOptionsByPath } from './routes/routes.jsx'
import { StartPage } from './pages/StartPage.jsx'
import { DiscoveryPage } from './pages/DiscoveryPage.jsx'
import { CreateTokenPage } from './pages/CreateTokenPage.jsx'
import { HoldingsPage } from './pages/HoldingsPage.jsx'
import { TokenDetailsPage } from './pages/TokenDetailsPage.jsx'
import { ChatPage } from './pages/ChatPage.jsx'
import { LeaderboardPage } from './pages/LeaderboardPage.jsx'
import { BackgroundPage } from './pages/BackgroundPage.tsx'
import { ContractTest } from './pages/ContractTest.tsx'

function WithLayout({ children }) {
  const { pathname } = useLocation()
  const headerOptions = getHeaderOptionsByPath(pathname)
  const title = Object.values(ROUTES).find(r => r.path === pathname)?.title || 'Cinder'
  return <Layout title={title} headerOptions={headerOptions}>{children}</Layout>
}

export default function App() {
  const { wallet } = useWallet();

  // if (!wallet) {
  //   return <div>No wallet</div>
  // }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.discovery.path} replace />} />
        <Route path={ROUTES.start.path} element={<StartPage />} />
        <Route path={ROUTES.discovery.path} element={<WithLayout><DiscoveryPage /></WithLayout>} />
        <Route path={ROUTES.create.path} element={<WithLayout><CreateTokenPage /></WithLayout>} />
        <Route path={ROUTES.holdings.path} element={<WithLayout><HoldingsPage /></WithLayout>} />
        <Route path={ROUTES.token.path} element={<WithLayout><TokenDetailsPage /></WithLayout>} />
        <Route path={ROUTES.chat.path} element={<WithLayout><ChatPage /></WithLayout>} />
        <Route path={ROUTES.leaderboard.path} element={<WithLayout><LeaderboardPage /></WithLayout>} />
        <Route path={ROUTES.background.path} element={<BackgroundPage />} />
        <Route path={ROUTES.test.path} element={<WithLayout><ContractTest /></WithLayout>} />
        <Route path="*" element={<Navigate to={ROUTES.discovery.path} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
