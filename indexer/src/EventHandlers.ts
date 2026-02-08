/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  Cinder,
  Cinder_SetImageEvent,
  Cinder_StrLog,
  Cinder_SetNameEvent,
  Cinder_SetDecimalsEvent,
  Cinder_SetSymbolEvent,
  Cinder_InitializeEvent,
  Cinder_SetOwnerEvent,
  Cinder_TotalSupplyEvent,
  Cinder_Transfer,
  Cinder_Mint,
  Cinder_Burn,
  Launchpad,
  Launchpad_CampaignLaunchedEvent,
  Launchpad_BuyEvent,
  Launchpad_TotalSupplyEvent,
  Launchpad_MintEvent,
  Launchpad_CampaignCreatedEvent,
  Launchpad_PledgedEvent,
  Launchpad_SellEvent,
  Launchpad_ClaimEvent,
  Launchpad_SetNameEvent,
  Launchpad_SetSymbolEvent,
  Launchpad_CampaignDeniedEvent,
  Launchpad_SetDecimalsEvent,
  Launchpad_StrLog,
  Launchpad_CampaignDeletedEvent,
  Launchpad_Transfer,
  Launchpad_Mint,
  Launchpad_Burn,
  User,
  Campaign,
  Trade,
  Pledge,
  DailyStats,
  UserDayActivity,
  CampaignDailyStats,
  CampaignUserDayActivity,
} from "generated";

const identityToId = (identity: { case: "Address" | "ContractId"; payload: { bits: string } }) =>
  identity.payload.bits;

const getTimestamp = (event: { block: { time: number } }) => BigInt(event.block.time);
const getBlockHeight = (event: { block: { height: number } }) => BigInt(event.block.height);
const getTxId = (event: { transaction: { id: string } }) => event.transaction.id;
const DAY_SECONDS = 86_400n;

const getDayId = (timestamp: bigint) => (timestamp / DAY_SECONDS).toString();
const getDayStart = (timestamp: bigint) => (timestamp / DAY_SECONDS) * DAY_SECONDS;

const upsertUser = async (
  context: { User: { get: (id: string) => Promise<User | undefined>; set: (user: User) => void } },
  userId: string,
  timestamp: bigint,
  actionDelta: bigint,
  volumeDelta: bigint,
) => {
  const user = await context.User.get(userId);
  if (!user) {
    context.User.set({
      id: userId,
      first_seen_at: timestamp,
      last_seen_at: timestamp,
      total_actions: actionDelta,
      total_volume_base: volumeDelta,
    });
    return;
  }

  const updatedUser: User = {
    ...user,
    last_seen_at: timestamp,
    total_actions: user.total_actions + actionDelta,
    total_volume_base: user.total_volume_base + volumeDelta,
  };
  context.User.set(updatedUser);
};

const upsertCampaign = async (
  context: { Campaign: { get: (id: string) => Promise<Campaign | undefined>; set: (campaign: Campaign) => void } },
  campaignId: string,
  data: Omit<Campaign, "id">,
) => {
  const campaign = await context.Campaign.get(campaignId);
  const updatedCampaign: Campaign = campaign
    ? { ...campaign, ...data }
    : {
        id: campaignId,
        ...data,
      };
  context.Campaign.set(updatedCampaign);
};

const upsertDailyStats = async (
  context: {
    DailyStats: { get: (id: string) => Promise<DailyStats | undefined>; set: (stats: DailyStats) => void };
  },
  dayId: string,
  dayStart: bigint,
  actionDelta: bigint,
  volumeDelta: bigint,
  liquidityDelta: bigint,
) => {
  const stats = await context.DailyStats.get(dayId);
  if (!stats) {
    context.DailyStats.set({
      id: dayId,
      date_start: dayStart,
      unique_users: 0n,
      total_actions: actionDelta,
      total_volume_base: volumeDelta,
      liquidity_end_base: liquidityDelta,
      liquidity_change_base: liquidityDelta,
    });
    return;
  }

  const updatedStats: DailyStats = {
    ...stats,
    total_actions: stats.total_actions + actionDelta,
    total_volume_base: stats.total_volume_base + volumeDelta,
    liquidity_end_base: stats.liquidity_end_base + liquidityDelta,
    liquidity_change_base: stats.liquidity_change_base + liquidityDelta,
  };
  context.DailyStats.set(updatedStats);
};

const markUserActiveForDay = async (
  context: {
    UserDayActivity: {
      get: (id: string) => Promise<UserDayActivity | undefined>;
      set: (activity: UserDayActivity) => void;
    };
    DailyStats: { get: (id: string) => Promise<DailyStats | undefined>; set: (stats: DailyStats) => void };
  },
  userId: string,
  dayId: string,
  dayStart: bigint,
  timestamp: bigint,
) => {
  const activityId = `${userId}-${dayId}`;
  const existing = await context.UserDayActivity.get(activityId);
  if (existing) {
    return;
  }

  context.UserDayActivity.set({
    id: activityId,
    user_id: userId,
    day_id: dayId,
    first_seen_at: timestamp,
  });

  const stats = await context.DailyStats.get(dayId);
  if (!stats) {
    context.DailyStats.set({
      id: dayId,
      date_start: dayStart,
      unique_users: 1n,
      total_actions: 0n,
      total_volume_base: 0n,
      liquidity_end_base: 0n,
      liquidity_change_base: 0n,
    });
    return;
  }

  const updatedStats: DailyStats = {
    ...stats,
    unique_users: stats.unique_users + 1n,
  };
  context.DailyStats.set(updatedStats);
};

const upsertCampaignDailyStats = async (
  context: {
    CampaignDailyStats: {
      get: (id: string) => Promise<CampaignDailyStats | undefined>;
      set: (stats: CampaignDailyStats) => void;
    };
  },
  campaignId: string,
  dayId: string,
  dayStart: bigint,
  actionDelta: bigint,
  volumeDelta: bigint,
  liquidityDelta: bigint,
) => {
  const statsId = `${campaignId}-${dayId}`;
  const stats = await context.CampaignDailyStats.get(statsId);
  if (!stats) {
    context.CampaignDailyStats.set({
      id: statsId,
      campaign_id: campaignId,
      day_id: dayId,
      date_start: dayStart,
      unique_users: 0n,
      total_actions: actionDelta,
      total_volume_base: volumeDelta,
      liquidity_end_base: liquidityDelta,
      liquidity_change_base: liquidityDelta,
    });
    return;
  }

  const updatedStats: CampaignDailyStats = {
    ...stats,
    total_actions: stats.total_actions + actionDelta,
    total_volume_base: stats.total_volume_base + volumeDelta,
    liquidity_end_base: stats.liquidity_end_base + liquidityDelta,
    liquidity_change_base: stats.liquidity_change_base + liquidityDelta,
  };
  context.CampaignDailyStats.set(updatedStats);
};

const markCampaignUserActiveForDay = async (
  context: {
    CampaignUserDayActivity: {
      get: (id: string) => Promise<CampaignUserDayActivity | undefined>;
      set: (activity: CampaignUserDayActivity) => void;
    };
    CampaignDailyStats: {
      get: (id: string) => Promise<CampaignDailyStats | undefined>;
      set: (stats: CampaignDailyStats) => void;
    };
  },
  campaignId: string,
  userId: string,
  dayId: string,
  dayStart: bigint,
  timestamp: bigint,
) => {
  const activityId = `${campaignId}-${userId}-${dayId}`;
  const existing = await context.CampaignUserDayActivity.get(activityId);
  if (existing) {
    return;
  }

  context.CampaignUserDayActivity.set({
    id: activityId,
    campaign_id: campaignId,
    user_id: userId,
    day_id: dayId,
    first_seen_at: timestamp,
  });

  const statsId = `${campaignId}-${dayId}`;
  const stats = await context.CampaignDailyStats.get(statsId);
  if (!stats) {
    context.CampaignDailyStats.set({
      id: statsId,
      campaign_id: campaignId,
      day_id: dayId,
      date_start: dayStart,
      unique_users: 1n,
      total_actions: 0n,
      total_volume_base: 0n,
      liquidity_end_base: 0n,
      liquidity_change_base: 0n,
    });
    return;
  }

  const updatedStats: CampaignDailyStats = {
    ...stats,
    unique_users: stats.unique_users + 1n,
  };
  context.CampaignDailyStats.set(updatedStats);
};

Cinder.SetImageEvent.handler(async ({ event, context }) => {
  const entity: Cinder_SetImageEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_SetImageEvent.set(entity);
});

Cinder.StrLog.handler(async ({ event, context }) => {
  const entity: Cinder_StrLog = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_StrLog.set(entity);
});

Cinder.SetNameEvent.handler(async ({ event, context }) => {
  const entity: Cinder_SetNameEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_SetNameEvent.set(entity);
});

Cinder.SetDecimalsEvent.handler(async ({ event, context }) => {
  const entity: Cinder_SetDecimalsEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_SetDecimalsEvent.set(entity);
});

Cinder.SetSymbolEvent.handler(async ({ event, context }) => {
  const entity: Cinder_SetSymbolEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_SetSymbolEvent.set(entity);
});

Cinder.InitializeEvent.handler(async ({ event, context }) => {
  const entity: Cinder_InitializeEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_InitializeEvent.set(entity);
});

Cinder.SetOwnerEvent.handler(async ({ event, context }) => {
  const entity: Cinder_SetOwnerEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_SetOwnerEvent.set(entity);
});

Cinder.TotalSupplyEvent.handler(async ({ event, context }) => {
  const entity: Cinder_TotalSupplyEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_TotalSupplyEvent.set(entity);
});

Cinder.Transfer.handler(async ({ event, context }) => {
  const entity: Cinder_Transfer = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_Transfer.set(entity);
});

Cinder.Mint.handler(async ({ event, context }) => {
  const entity: Cinder_Mint = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_Mint.set(entity);
});

Cinder.Burn.handler(async ({ event, context }) => {
  const entity: Cinder_Burn = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Cinder_Burn.set(entity);
});


Launchpad.CampaignLaunchedEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_CampaignLaunchedEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_CampaignLaunchedEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const campaignId = event.params.asset_id.bits;
  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      status: "Launched",
    };
    context.Campaign.set(updatedCampaign);
  }
});

Launchpad.BuyEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_BuyEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_BuyEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const campaignId = event.params.asset_id.bits;
  const userId = identityToId(event.params.sender);
  const dayId = getDayId(timestamp);
  const dayStart = getDayStart(timestamp);

  await upsertUser(context, userId, timestamp, 1n, event.params.cost);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, event.params.cost, event.params.cost);
  await markCampaignUserActiveForDay(context, campaignId, userId, dayId, dayStart, timestamp);
  await upsertCampaignDailyStats(
    context,
    campaignId,
    dayId,
    dayStart,
    1n,
    event.params.cost,
    event.params.cost,
  );

  const trade: Trade = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    user_id: userId,
    campaign_id: campaignId,
    side: "buy",
    amount_token: event.params.amount,
    amount_base: event.params.cost,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.Trade.set(trade);

  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      total_volume_base: campaign.total_volume_base + event.params.cost,
    };
    context.Campaign.set(updatedCampaign);
  }
});

Launchpad.TotalSupplyEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_TotalSupplyEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_TotalSupplyEvent.set(entity);
});

Launchpad.MintEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_MintEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_MintEvent.set(entity);
});

Launchpad.CampaignCreatedEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_CampaignCreatedEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_CampaignCreatedEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const timestamp = getTimestamp(event);
  const campaignId = event.params.asset_id.bits;
  const creatorId = identityToId(event.params.creator);
  const tokenInfo = event.params.token_info;
  const dayId = getDayId(timestamp);
  const dayStart = getDayStart(timestamp);

  await upsertUser(context, creatorId, timestamp, 1n, 0n);
  await markUserActiveForDay(context, creatorId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, 0n, 0n);
  await markCampaignUserActiveForDay(context, campaignId, creatorId, dayId, dayStart, timestamp);
  await upsertCampaignDailyStats(context, campaignId, dayId, dayStart, 1n, 0n, 0n);

  await upsertCampaign(context, campaignId, {
    creator_id: creatorId,
    created_at: timestamp,
    target: event.params.target,
    total_pledged: 0n,
    total_volume_base: 0n,
    status: "Active",
    token_asset_id: tokenInfo.asset_id.bits,
    token_name: tokenInfo.name,
    token_ticker: tokenInfo.ticker,
    token_description: tokenInfo.description,
    token_decimals: tokenInfo.decimals,
    token_image: tokenInfo.image,
    image: tokenInfo.image,
  });
});

Launchpad.PledgedEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_PledgedEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_PledgedEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const campaignId = event.params.asset_id.bits;
  const userId = identityToId(event.params.sender);
  const dayId = getDayId(timestamp);
  const dayStart = getDayStart(timestamp);

  await upsertUser(context, userId, timestamp, 1n, 0n);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, 0n, 0n);
  await markCampaignUserActiveForDay(context, campaignId, userId, dayId, dayStart, timestamp);
  await upsertCampaignDailyStats(context, campaignId, dayId, dayStart, 1n, 0n, 0n);

  const pledge: Pledge = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    user_id: userId,
    campaign_id: campaignId,
    amount: event.params.amount,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.Pledge.set(pledge);

  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      total_pledged: event.params.total_pledged,
    };
    context.Campaign.set(updatedCampaign);
  }
});

Launchpad.SellEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_SellEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_SellEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const campaignId = event.params.asset_id.bits;
  const userId = identityToId(event.params.sender);
  const dayId = getDayId(timestamp);
  const dayStart = getDayStart(timestamp);

  await upsertUser(context, userId, timestamp, 1n, event.params.refund);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, event.params.refund, -event.params.refund);
  await markCampaignUserActiveForDay(context, campaignId, userId, dayId, dayStart, timestamp);
  await upsertCampaignDailyStats(
    context,
    campaignId,
    dayId,
    dayStart,
    1n,
    event.params.refund,
    -event.params.refund,
  );

  const trade: Trade = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    user_id: userId,
    campaign_id: campaignId,
    side: "sell",
    amount_token: event.params.amount,
    amount_base: event.params.refund,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.Trade.set(trade);

  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      total_volume_base: campaign.total_volume_base + event.params.refund,
    };
    context.Campaign.set(updatedCampaign);
  }
});

Launchpad.ClaimEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_ClaimEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_ClaimEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const timestamp = getTimestamp(event);
  const userId = identityToId(event.params.sender);
  const dayId = getDayId(timestamp);
  const dayStart = getDayStart(timestamp);
  await upsertUser(context, userId, timestamp, 1n, 0n);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, 0n, 0n);
});

Launchpad.SetNameEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_SetNameEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_SetNameEvent.set(entity);
});

Launchpad.SetSymbolEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_SetSymbolEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_SetSymbolEvent.set(entity);
});

Launchpad.CampaignDeniedEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_CampaignDeniedEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_CampaignDeniedEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const campaignId = event.params.asset_id.bits;
  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      status: "Failed",
    };
    context.Campaign.set(updatedCampaign);
  }
});

Launchpad.SetDecimalsEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_SetDecimalsEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_SetDecimalsEvent.set(entity);
});

Launchpad.StrLog.handler(async ({ event, context }) => {
  const entity: Launchpad_StrLog = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_StrLog.set(entity);
});

Launchpad.CampaignDeletedEvent.handler(async ({ event, context }) => {
  const entity: Launchpad_CampaignDeletedEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_CampaignDeletedEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const campaignId = event.params.asset_id.bits;
  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      status: "Deleted",
    };
    context.Campaign.set(updatedCampaign);
  }
});

Launchpad.Transfer.handler(async ({ event, context }) => {
  const entity: Launchpad_Transfer = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_Transfer.set(entity);
});

Launchpad.Mint.handler(async ({ event, context }) => {
  const entity: Launchpad_Mint = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_Mint.set(entity);
});

Launchpad.Burn.handler(async ({ event, context }) => {
  const entity: Launchpad_Burn = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };

  context.Launchpad_Burn.set(entity);
});

