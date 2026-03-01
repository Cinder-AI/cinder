export type Campaign = {
  id: string;
  status: string;
  token_asset_id: string;
  token_decimals: number;
};

export type CampaignMigratedEvent = {
  campaign_id: string;
  fuel_reserve: string;
  token_reserve: string;
  timestamp: string;
  tx_id: string;
};

export type ReactorPoolCreateEvent = {
  pool_id: string;
  token_0_asset_id: string;
  token_1_asset_id: string;
  fee: string;
  timestamp: string;
};

export type ReactorPoolSwapEvent = {
  recipient_id: string;
  asset_0_in: string;
  asset_1_in: string;
  asset_0_out: string;
  asset_1_out: string;
};

export type CampaignUpdatedSseData = {
  type: "campaign_updated";
  campaignId: string;
  status?: string | null;
};

export type CampaignMigratedSseData = {
  type: "campaign_migrated";
  campaignId: string;
  status?: string | null;
};

export type CampaignMigrationSignal = CampaignUpdatedSseData | CampaignMigratedSseData | {
  type?: string;
  campaignId: string;
  status: string;
}

export type GraphQLWebhookPayload = {
  created_at: string;
  delivery_info: {
    current_retry: number;
    max_retries: number;
  };
  event: {
    data: {
      new: Campaign;
      old: Campaign;
    };
    op: string;
    session_variables: any;
    trace_context: any;
  };
  id: string;
  table: { name: string; schema: string };
  trigger: { name: string };
  version: string;
}

export type SseEvent = {
  id?: string;
  event: string;
  data: string;
};

