export const ROUTES = {
  start: { path: '/start', title: 'Start', headerOptions: { showCreate: false, showBalance: false } },
  discovery: { path: '/discovery', title: 'Discovery', headerOptions: { showCreate: true, showBalance: false } },
  create: { path: '/create', title: 'Create Token', headerOptions: { showCreate: false, showBalance: false, showBackButton: true } },
  holdings: { path: '/holdings', title: 'Holdings', headerOptions: { showCreate: false, showBalance: false, showBackButton: true } },
  leaderboard: { path: '/leaderboard', title: 'Leaderboard', headerOptions: { showCreate: false, showBalance: false, showBackButton: true } },
  token: { path: '/token/:id', title: 'Token Details', headerOptions: { showCreate: true, showBalance: false, showBackButton: true } },
  chat: { path: '/chat/:id', title: 'Chat', headerOptions: { showCreate: true, showBalance: false, showBackButton: true } },
  background: { path: '/background', title: 'Background', headerOptions: { showCreate: false, showBalance: false } },
  test: { path: '/test', title: 'Test', headerOptions: { showCreate: false, showBalance: false } },
}

export function getHeaderOptionsByPath(pathname) {
  console.log(pathname)
  if (pathname.startsWith('/token/')) return ROUTES.token.headerOptions
  if (pathname.startsWith('/chat/')) return ROUTES.chat.headerOptions
  if (pathname.startsWith('/background/')) return ROUTES.background.headerOptions
  switch (pathname) {
    case ROUTES.discovery.path: return ROUTES.discovery.headerOptions
    case ROUTES.create.path: return ROUTES.create.headerOptions
    case ROUTES.holdings.path: return ROUTES.holdings.headerOptions
    case ROUTES.leaderboard.path: return ROUTES.leaderboard.headerOptions
    case ROUTES.start.path: return ROUTES.start.headerOptions
    case ROUTES.test.path: return ROUTES.test.headerOptions
    default: return ROUTES.discovery.headerOptions
  }
}





