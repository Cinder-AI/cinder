export const SYSTEM_TOKENS = [
  {
    id: 'stFUEL',
    name: 'stFUEL',
    image: 'assets/stFUEL.png',
    creator: 'system',
    progress: 100,
    timeAgo: 'genesis',
    isSystemToken: true,
  },
  {
    id: 'CIN',
    name: 'CIN',
    image: 'assets/CIN.png',
    creator: 'system',
    progress: 100,
    timeAgo: 'genesis',
    isSystemToken: true,
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
