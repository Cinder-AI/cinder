/// <reference types="vite/client" />

import { APP_CONFIG } from "../config"
const DEFAULT_INDEXER_URL = APP_CONFIG.INDEXER_URL
const DEFAULT_SSE_URL = APP_CONFIG.SSE_URL

export type CampaignRecord = {
  id: string
  creator_id: string
  name: string
  ticker: string
  description: string
  decimals: number
  image: string
  status: string
  target: string
  total_pledged: string
  total_volume_base: string
  virtual_base_reserve: string
  virtual_token_reserve: string
  curve_sold_supply: string
  curve_max_supply: string
  current_price_scaled: string
  current_price: string
  curve_reserve: string
  has_boost: boolean
  boost_multiplier_x1e6: string
  boost_duration_secs: string
  boost_burned_at: string
  boost_ends_at: string
  created_at: string
}

export type PledgeRecord = {
  id: string
  user_id: string
  campaign_id: string
  amount: string
  timestamp: string
  tx_id: string
  block_height: string
}

export type ChartSeriesPoint = {
  t: number
  price_scaled: string
  price: number
  price_usd?: number | null
}

export type CandlePoint = {
  t: number
  o: string
  h: string
  l: string
  c: string
  v_base: string
  v_token: string
  n: number
}

export type ChartHistoryResponse = {
  ok: boolean
  campaignId: string
  fromTs: number
  toTs: number
  intervalSec: number
  series: ChartSeriesPoint[]
  candles: CandlePoint[]
  summary: ChartSummary
  fuelUsd?: number | null
  fuelUsdUpdatedAt?: string | null
}

export type ChartSummary = {
  firstPriceScaled: string | null
  lastPriceScaled: string | null
  firstPrice: number | null
  lastPrice: number | null
  priceChangePct: number
  highPriceScaled: string | null
  lowPriceScaled: string | null
  highPrice: number | null
  lowPrice: number | null
  volumeBase: string
  volumeUsd?: number | null
  volumeToken: string
  tradeCount: number
}

export type CampaignSnapshot = {
  type: 'campaign_updated'
  op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL'
  campaignId: string
  currentPrice?: string | null
  currentPriceScaled?: string | null
  currentPriceUsd?: number | null
  totalVolumeBase?: string | null
  totalVolumeUsd?: number | null
  totalPledged?: string | null
  progress?: number | null
  curveSoldSupply?: string | null
  curveMaxSupply?: string | null
  marketCapBase?: string | null
  marketCapUsd?: number | null
  fuelUsd?: number | null
  fuelUsdUpdatedAt?: string | null
  status?: string | null
  updatedAt: string
}

export type CampaignSnapshotResponse = {
  ok: boolean
  campaignId: string
  snapshot: CampaignSnapshot
}

export type AdminOverview = {
  dau: number
  wau: number
  mau: number
  totalUsers: number
  totalVolume30d: string
  totalVolumeAll: string
}

export type CampaignStatusCounts = {
  launched: number
  active: number
  migrated: number
  denied: number
  dead: number
}

export type DailyTrendPoint = {
  date_start: string
  unique_users: string
  total_actions: string
  total_volume_base: string
  liquidity_end_base: string
}

class IndexerGraphQLService {
  private endpoint: string

  constructor(endpoint: string = DEFAULT_INDEXER_URL) {
    this.endpoint = endpoint
  }

  private async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      throw new Error(`Indexer request failed: ${response.statusText}`)
    }

    const json = await response.json()
    if (json.errors) {
      throw new Error(JSON.stringify(json.errors))
    }

    return json.data
  }

  async getCampaigns(): Promise<CampaignRecord[]> {
    const query = `
      query Campaigns {
        Campaign {
          id
          creator_id
          created_at
          target
          total_pledged
          total_volume_base
          status,
          name,
          ticker,
          description,
          decimals,
          image,
          virtual_base_reserve,
          virtual_token_reserve,
          curve_sold_supply,
          curve_max_supply,
          current_price_scaled,
          current_price,
          curve_reserve,
          has_boost,
          boost_multiplier_x1e6,
          boost_duration_secs,
          boost_burned_at,
          boost_ends_at,
        }
      }
    `

    const result = await this.query<{ Campaign: CampaignRecord[] }>(query)
    return result.Campaign || []
  }

  async getUserPledges(userId: string): Promise<PledgeRecord[]> {
    if (!userId) return []
    const query = `
      query Pledges($userId: String!) {
        Pledge(where: { user_id: { _eq: $userId } }) {
          id
          user_id
          campaign_id
          amount
          timestamp
          tx_id
          block_height
        }
      }
    `

    const result = await this.query<{ Pledge: PledgeRecord[] }>(query, { userId })
    return result.Pledge || []
  }

  async getAdminOverview(nowTsSec: number = Math.floor(Date.now() / 1000)): Promise<AdminOverview> {
    const daySec = 24 * 60 * 60
    const dauFrom = nowTsSec - daySec
    const wauFrom = nowTsSec - 7 * daySec
    const mauFrom = nowTsSec - 30 * daySec
    const volumeFrom = mauFrom

    const query = `
      query AdminOverview(
        $dauFrom: BigInt!
        $wauFrom: BigInt!
        $mauFrom: BigInt!
        $volumeFrom: BigInt!
      ) {
        dau: UserDayActivity_aggregate(where: { first_seen_at: { _gte: $dauFrom } }) {
          aggregate { count(columns: user_id, distinct: true) }
        }
        wau: UserDayActivity_aggregate(where: { first_seen_at: { _gte: $wauFrom } }) {
          aggregate { count(columns: user_id, distinct: true) }
        }
        mau: UserDayActivity_aggregate(where: { first_seen_at: { _gte: $mauFrom } }) {
          aggregate { count(columns: user_id, distinct: true) }
        }
        users: User_aggregate {
          aggregate { count }
        }
        trades30: Trade_aggregate(where: { timestamp: { _gte: $volumeFrom } }) {
          aggregate { sum { amount_base } }
        }
        tradesAll: Trade_aggregate {
          aggregate { sum { amount_base } }
        }
      }
    `

    const result = await this.query<{
      dau?: { aggregate?: { count?: number | null } | null } | null
      wau?: { aggregate?: { count?: number | null } | null } | null
      mau?: { aggregate?: { count?: number | null } | null } | null
      users?: { aggregate?: { count?: number | null } | null } | null
      trades30?: { aggregate?: { sum?: { amount_base?: string | null } | null } | null } | null
      tradesAll?: { aggregate?: { sum?: { amount_base?: string | null } | null } | null } | null
    }>(query, { dauFrom, wauFrom, mauFrom, volumeFrom })

    return {
      dau: Number(result?.dau?.aggregate?.count || 0),
      wau: Number(result?.wau?.aggregate?.count || 0),
      mau: Number(result?.mau?.aggregate?.count || 0),
      totalUsers: Number(result?.users?.aggregate?.count || 0),
      totalVolume30d: result?.trades30?.aggregate?.sum?.amount_base || '0',
      totalVolumeAll: result?.tradesAll?.aggregate?.sum?.amount_base || '0',
    }
  }

  async getCampaignStatusCounts(): Promise<CampaignStatusCounts> {
    const query = `
      query CampaignStatusCounts {
        launched: Campaign_aggregate {
          aggregate { count }
        }
        active: Campaign_aggregate(where: { status: { _eq: "active" } }) {
          aggregate { count }
        }
        migrated: Launchpad_CampaignMigratedEvent_aggregate {
          aggregate { count(columns: campaign_id, distinct: true) }
        }
        denied: Launchpad_CampaignDeniedEvent_aggregate {
          aggregate { count(columns: campaign_id, distinct: true) }
        }
        dead: Launchpad_CampaignDeletedEvent_aggregate {
          aggregate { count }
        }
      }
    `

    const result = await this.query<{
      launched?: { aggregate?: { count?: number | null } | null } | null
      active?: { aggregate?: { count?: number | null } | null } | null
      migrated?: { aggregate?: { count?: number | null } | null } | null
      denied?: { aggregate?: { count?: number | null } | null } | null
      dead?: { aggregate?: { count?: number | null } | null } | null
    }>(query)

    return {
      launched: Number(result?.launched?.aggregate?.count || 0),
      active: Number(result?.active?.aggregate?.count || 0),
      migrated: Number(result?.migrated?.aggregate?.count || 0),
      denied: Number(result?.denied?.aggregate?.count || 0),
      dead: Number(result?.dead?.aggregate?.count || 0),
    }
  }

  async getDailyTrend(limit: number = 30): Promise<DailyTrendPoint[]> {
    const query = `
      query DailyTrend($limit: Int!) {
        DailyStats(order_by: { date_start: desc }, limit: $limit) {
          date_start
          unique_users
          total_actions
          total_volume_base
          liquidity_end_base
        }
      }
    `

    const result = await this.query<{ DailyStats: DailyTrendPoint[] }>(query, { limit })
    return (result.DailyStats || []).slice().reverse()
  }

  async getTopCampaigns(limit: number = 8): Promise<CampaignRecord[]> {
    const query = `
      query TopCampaigns($limit: Int!) {
        Campaign(order_by: { total_volume_base: desc }, limit: $limit) {
          id
          creator_id
          created_at
          target
          total_pledged
          total_volume_base
          status
          current_price
          current_price_scaled
          token_asset_id
          token_name
          token_ticker
          token_description
          token_decimals
          token_image
        }
      }
    `

    const result = await this.query<{ Campaign: CampaignRecord[] }>(query, { limit })
    return result.Campaign || []
  }
}

class SseApiService {
  private baseUrl: string

  constructor(baseUrl: string = DEFAULT_SSE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async getChartHistory(
    campaignId: string,
    params?: { fromTs?: number; toTs?: number; intervalSec?: number },
  ): Promise<ChartHistoryResponse> {
    const search = new URLSearchParams({ campaignId })
    if (params?.fromTs !== undefined) search.set('fromTs', String(params.fromTs))
    if (params?.toTs !== undefined) search.set('toTs', String(params.toTs))
    if (params?.intervalSec !== undefined) search.set('intervalSec', String(params.intervalSec))

    const res = await fetch(`${this.baseUrl}/chart/history?${search.toString()}`)
    if (!res.ok) {
      throw new Error(`Chart history request failed: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as ChartHistoryResponse
  }

  async getCampaignSnapshot(campaignId: string): Promise<CampaignSnapshotResponse> {
    const search = new URLSearchParams({ campaignId })
    const res = await fetch(`${this.baseUrl}/campaign/snapshot?${search.toString()}`)
    if (!res.ok) {
      throw new Error(`Campaign snapshot request failed: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as CampaignSnapshotResponse
  }
}

export const indexerGraphQL = new IndexerGraphQLService(
  import.meta.env.VITE_INDEXER_URL || DEFAULT_INDEXER_URL,
)
export const sseApi = new SseApiService(import.meta.env.VITE_SSE_URL || DEFAULT_SSE_URL)

export { IndexerGraphQLService, SseApiService }
