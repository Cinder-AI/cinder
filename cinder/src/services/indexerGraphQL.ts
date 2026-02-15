/// <reference types="vite/client" />

const DEFAULT_INDEXER_URL = 'http://localhost:8080/v1/graphql'
const DEFAULT_SSE_URL = 'http://localhost:5002'

export type CampaignRecord = {
  id: string
  creator_id: string
  created_at: string
  target: string
  total_pledged: string
  total_volume_base: string
  status: string
  token_asset_id?: string
  token_name?: string
  token_ticker?: string
  token_description?: string
  token_decimals?: number
  token_image?: string
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
          token_asset_id,
          token_name,
          token_ticker,
          token_description,
          token_decimals,
          token_image,
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
