export const SYSTEM_TOKENS = [
  {
    id: '0x177bae7c37ea20356abd7fc562f92677e9861f09d003d8d3da3c259a9ded7dd8',
    name: 'stFUEL',
    ticker: 'stFUEL',
    image: 'assets/stFUEL.png',
    creator: 'system',
    progress: 100,
    timeAgo: 'genesis',
    isSystemToken: true,
    assetId: null,
  },
  {
    id: 'CIN',
    name: 'CIN',
    ticker: 'CIN',
    image: 'assets/CIN.png',
    creator: 'system',
    progress: 100,
    timeAgo: 'genesis',
    isSystemToken: true,
    assetId: null,
  },
]

export function createDefaultState() {
  const tokens = [...SYSTEM_TOKENS]
  const leaderboardTokens = []
  const userHoldings = new Map()
  const user = { balance: '0' }
  const nextTokenId = calculateNextTokenId(tokens)

  return { tokens, leaderboardTokens, userHoldings, user, nextTokenId }
}

export function calculateNextTokenId(tokens) {
  const numericIds = tokens
    .map(token => Number(token.id))
    .filter(id => Number.isFinite(id))
  if (!numericIds.length) return 1
  return Math.max(...numericIds) + 1
}
