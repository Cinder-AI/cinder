/// <reference types="vite/client" />

const DEFAULT_INDEXER_URL = 'http://localhost:8080/v1/graphql'

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

export const indexerGraphQL = new IndexerGraphQLService(
  import.meta.env.VITE_INDEXER_URL || DEFAULT_INDEXER_URL,
)

export { IndexerGraphQLService }
