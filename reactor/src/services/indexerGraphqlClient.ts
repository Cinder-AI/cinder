import type {
  Campaign,
  CampaignMigratedEvent,
  ReactorPoolCreateEvent,
  ReactorPoolSwapEvent,
} from "../types.js";

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export class IndexerGraphqlClient {
  constructor(private readonly endpoint: string) {}

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Indexer GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GraphqlResponse<T>;
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }
    if (!payload.data) {
      throw new Error("Indexer GraphQL returned empty data");
    }
    return payload.data;
  }

  async getCampaignById(campaignId: string): Promise<Campaign | null> {
    const query = `
      query CampaignById($campaignId: String!) {
        Campaign(where: { id: { _eq: $campaignId } }, limit: 1) {
          id
          status
          token_asset_id
          token_decimals
        }
      }
    `;
    const data = await this.query<{ Campaign: Campaign[] }>(query, { campaignId });
    return data.Campaign[0] ?? null;
  }

  async getMigratedCampaigns(): Promise<Campaign[]> {
    const query = `
      query MigratedCampaigns($statuses: [String!]!) {
        Campaign(where: { status: { _in: $statuses } }) {
          id
          status
          token_asset_id
          token_decimals
        }
      }
    `;
    const data = await this.query<{ Campaign: Campaign[] }>(query, {
      statuses: ["Launched", "Migrated"],
    });
    return data.Campaign;
  }

  async getLatestCampaignMigrationEvent(campaignId: string): Promise<CampaignMigratedEvent | null> {
    const query = `
      query CampaignMigration($campaignId: String!) {
        Launchpad_CampaignMigratedEvent(
          where: { campaign_id: { _eq: $campaignId } }
          order_by: { timestamp: desc }
          limit: 1
        ) {
          campaign_id
          base_reserve
          token_reserve
          timestamp
          tx_id
        }
      }
    `;
    const data = await this.query<{ Launchpad_CampaignMigratedEvent: CampaignMigratedEvent[] }>(query, {
      campaignId,
    });
    return data.Launchpad_CampaignMigratedEvent[0] ?? null;
  }

  async getPoolForTokenPair(params: {
    tokenAssetId: string;
    baseAssetId: string;
    fee: string;
  }): Promise<ReactorPoolCreateEvent | null> {
    const query = `
      query PoolByTokenPair($tokenAssetId: String!, $baseAssetId: String!, $fee: bigint!) {
        ReactorPool_CreatePoolEvent(
          where: {
            fee: { _eq: $fee }
            _or: [
              {
                token_0_asset_id: { _eq: $tokenAssetId }
                token_1_asset_id: { _eq: $baseAssetId }
              }
              {
                token_0_asset_id: { _eq: $baseAssetId }
                token_1_asset_id: { _eq: $tokenAssetId }
              }
            ]
          }
          order_by: { timestamp: desc }
          limit: 1
        ) {
          pool_id
          token_0_asset_id
          token_1_asset_id
          fee
          timestamp
        }
      }
    `;
    const data = await this.query<{ ReactorPool_CreatePoolEvent: ReactorPoolCreateEvent[] }>(query, params);
    return data.ReactorPool_CreatePoolEvent[0] ?? null;
  }

  async getPoolSwapsSince(poolId: string, fromTs: bigint): Promise<ReactorPoolSwapEvent[]> {
    const query = `
      query PoolSwaps($poolId: String!, $fromTs: bigint!) {
        ReactorPool_SwapEvent(
          where: { pool_id: { _eq: $poolId }, timestamp: { _gte: $fromTs } }
          limit: 5000
          order_by: { timestamp: asc }
        ) {
          recipient_id
          asset_0_in
          asset_1_in
          asset_0_out
          asset_1_out
        }
      }
    `;
    const data = await this.query<{ ReactorPool_SwapEvent: ReactorPoolSwapEvent[] }>(query, {
      poolId,
      fromTs: fromTs.toString(),
    });
    return data.ReactorPool_SwapEvent;
  }
}
