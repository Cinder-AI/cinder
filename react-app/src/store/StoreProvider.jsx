import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { createDefaultState, calculateNextTokenId } from './defaultData'

const STORAGE_KEY = 'cinderStoreData'

const StoreContext = createContext(null)

function reviveState(raw) {
  if (!raw) return null
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (data && data.userHoldings && typeof data.userHoldings === 'object' && !(data.userHoldings instanceof Map)) {
    data.userHoldings = new Map(Object.entries(data.userHoldings).map(([k, v]) => [Number(k), v]))
  }
  if (!data.nextTokenId) data.nextTokenId = calculateNextTokenId(data.tokens || [])
  if (!data.leaderboardTokens) data.leaderboardTokens = createDefaultState().leaderboardTokens
  return data
}

function persistState(state) {
  const toSave = { ...state, userHoldings: Object.fromEntries(state.userHoldings) }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
}

const ACTIONS = {
  GET_TOKEN: 'GET_TOKEN',
  ADD_TOKEN: 'ADD_TOKEN',
  BUY_TOKEN: 'BUY_TOKEN',
  SELL_TOKEN: 'SELL_TOKEN',
  UPDATE_BALANCE: 'UPDATE_BALANCE',
  CLEAR_DATA: 'CLEAR_DATA',
  ADD_PLEDGE: 'ADD_PLEDGE',
  LAUNCH_CAMPAIGN: 'LAUNCH_CAMPAIGN',
  ADD_PLEDGE_LEADERBOARD: 'ADD_PLEDGE_LEADERBOARD',
  LAUNCH_CAMPAIGN_LEADERBOARD: 'LAUNCH_CAMPAIGN_LEADERBOARD',
  RESET_LEADERBOARD: 'RESET_LEADERBOARD',
}

const applyPledge = (tokens, tokenId, amount) =>
  tokens.map(token => {
    if (token.id !== tokenId) return token
    const totalPledged = token.totalPledged + amount
    const progress = Math.round((totalPledged / token.target) * 100)
    return { ...token, totalPledged, progress }
  })

const applyLaunch = (tokens, tokenId) =>
  tokens.map(token => (token.id === tokenId ? { ...token, status: 'launched' } : token))

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.GET_TOKEN: {
      return { ...state, tokens: action.payload }
    }
    case ACTIONS.ADD_TOKEN: {
      const newToken = {
        id: state.nextTokenId,
        progress: 0,
        timeAgo: 'just now',
        canSell: false,
        isSystemToken: false,
        ...action.payload,
      }
      return {
        ...state,
        tokens: [newToken, ...state.tokens],
        nextTokenId: state.nextTokenId + 1,
      }
    }
    case ACTIONS.BUY_TOKEN: {
      const { tokenId, amount, value } = action.payload
      const next = new Map(state.userHoldings)
      if (next.has(tokenId)) {
        const current = next.get(tokenId)
        next.set(tokenId, { ...current, amount, value })
      } else {
        next.set(tokenId, { amount, value, canSell: true })
      }
      return { ...state, userHoldings: next }
    }
    case ACTIONS.SELL_TOKEN: {
      const next = new Map(state.userHoldings)
      next.delete(action.payload.tokenId)
      return { ...state, userHoldings: next }
    }
    case ACTIONS.UPDATE_BALANCE:
      return { ...state, user: { ...state.user, balance: action.payload.balance } }
    case ACTIONS.ADD_PLEDGE: {
      const { tokenId, amount } = action.payload
      return { ...state, tokens: applyPledge(state.tokens, tokenId, amount) }
    }
    case ACTIONS.LAUNCH_CAMPAIGN: {
      const { tokenId } = action.payload
      return { ...state, tokens: applyLaunch(state.tokens, tokenId) }
    }
    case ACTIONS.ADD_PLEDGE_LEADERBOARD: {
      const { tokenId, amount } = action.payload
      return { ...state, leaderboardTokens: applyPledge(state.leaderboardTokens, tokenId, amount) }
    }
    case ACTIONS.LAUNCH_CAMPAIGN_LEADERBOARD: {
      const { tokenId } = action.payload
      return { ...state, leaderboardTokens: applyLaunch(state.leaderboardTokens, tokenId) }
    }
    case ACTIONS.RESET_LEADERBOARD: {
      return { ...state, leaderboardTokens: createDefaultState().leaderboardTokens }
    }
    case ACTIONS.CLEAR_DATA:
      return createDefaultState()
    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return reviveState(stored) || createDefaultState()
    } catch {
      return createDefaultState()
    }
  })

  // useEffect(() => { persistState(state) }, [state])

  const api = useMemo(() => ({
    state,
    getToken: (tokenId) => state.tokens.find(t => t.id === tokenId),
    getTokenByName: (name) => state.tokens.find(t => t.name === name),
    
    getTokens: () => state.tokens,
    getLeaderboardTokens: () => state.leaderboardTokens,
    getUserHoldings: () => {
      const list = []
      for (const [tokenId, holding] of state.userHoldings) {
        const token = state.tokens.find(t => t.id === tokenId)
        if (token) list.push({ ...token, ...holding, tokenId })
      }
      return list
    },
    addToken: (tokenData) => dispatch({ type: ACTIONS.ADD_TOKEN, payload: tokenData }),
    buyToken: (tokenId, amount, value) => dispatch({ type: ACTIONS.BUY_TOKEN, payload: { tokenId, amount, value } }),
    sellToken: (tokenId) => dispatch({ type: ACTIONS.SELL_TOKEN, payload: { tokenId } }),
    getUserBalance: () => state.user.balance,
    updateUserBalance: (balance) => dispatch({ type: ACTIONS.UPDATE_BALANCE, payload: { balance } }),
    addPledge: (tokenId, amount) => dispatch({ type: ACTIONS.ADD_PLEDGE, payload: { tokenId, amount } }),
    launchCampaign: (tokenId) => dispatch({ type: ACTIONS.LAUNCH_CAMPAIGN, payload: { tokenId } }),
    addLeaderboardPledge: (tokenId, amount) => dispatch({ type: ACTIONS.ADD_PLEDGE_LEADERBOARD, payload: { tokenId, amount } }),
    launchLeaderboardCampaign: (tokenId) => dispatch({ type: ACTIONS.LAUNCH_CAMPAIGN_LEADERBOARD, payload: { tokenId } }),
    resetLeaderboardTokens: () => dispatch({ type: ACTIONS.RESET_LEADERBOARD }),
    clearData: () => dispatch({ type: ACTIONS.CLEAR_DATA }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state])

  return (
    <StoreContext.Provider value={api}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}


