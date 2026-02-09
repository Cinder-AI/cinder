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
  Campaign,
  Trade,
  Pledge,
} from "generated";
import {
  markCampaignUserActiveForDay,
  markUserActiveForDay,
  upsertCampaign,
  upsertCampaignDailyStats,
  upsertDailyStats,
  upsertUser,
} from "./utils/stats";
import { getBlockHeight, getDayId, getDayStart, getTimestamp, getTxId } from "./utils/time";
import { BASE_ASSET_DECIMALS, toHuman } from "./utils/units";

const identityToId = (identity: { case: "Address" | "ContractId"; payload: { bits: string } }) =>
  identity.payload.bits;

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

  const humanCost = toHuman(event.params.cost, BASE_ASSET_DECIMALS);
  await upsertUser(context, userId, timestamp, 1n, humanCost);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, humanCost, humanCost);
  await markCampaignUserActiveForDay(context, campaignId, userId, dayId, dayStart, timestamp);
  await upsertCampaignDailyStats(
    context,
    campaignId,
    dayId,
    dayStart,
    1n,
    humanCost,
    humanCost,
  );

  const campaign = await context.Campaign.get(campaignId);
  const tokenDecimals = campaign?.token_decimals ?? 0;
  const humanAmountToken = toHuman(event.params.amount, tokenDecimals);
  const trade: Trade = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    user_id: userId,
    campaign_id: campaignId,
    side: "buy",
    amount_token: humanAmountToken,
    amount_base: humanCost,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.Trade.set(trade);

  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      total_volume_base: campaign.total_volume_base + humanCost,
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

  const humanTarget = toHuman(event.params.target, BASE_ASSET_DECIMALS);
  await upsertCampaign(context, campaignId, {
    creator_id: creatorId,
    created_at: timestamp,
    target: humanTarget,
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

  const humanPledgeAmount = toHuman(event.params.amount, BASE_ASSET_DECIMALS);
  const humanTotalPledged = toHuman(event.params.total_pledged, BASE_ASSET_DECIMALS);
  await upsertUser(context, userId, timestamp, 1n, 0n);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, 0n, 0n);
  await markCampaignUserActiveForDay(context, campaignId, userId, dayId, dayStart, timestamp);
  await upsertCampaignDailyStats(context, campaignId, dayId, dayStart, 1n, 0n, 0n);

  const pledge: Pledge = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    user_id: userId,
    campaign_id: campaignId,
    amount: humanPledgeAmount,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.Pledge.set(pledge);

  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      total_pledged: humanTotalPledged,
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

  const humanRefund = toHuman(event.params.refund, BASE_ASSET_DECIMALS);
  await upsertUser(context, userId, timestamp, 1n, humanRefund);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, humanRefund, -humanRefund);
  await markCampaignUserActiveForDay(context, campaignId, userId, dayId, dayStart, timestamp);
  await upsertCampaignDailyStats(
    context,
    campaignId,
    dayId,
    dayStart,
    1n,
    humanRefund,
    -humanRefund,
  );

  const campaign = await context.Campaign.get(campaignId);
  const tokenDecimals = campaign?.token_decimals ?? 0;
  const humanAmountToken = toHuman(event.params.amount, tokenDecimals);
  const trade: Trade = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    user_id: userId,
    campaign_id: campaignId,
    side: "sell",
    amount_token: humanAmountToken,
    amount_base: humanRefund,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.Trade.set(trade);

  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      total_volume_base: campaign.total_volume_base + humanRefund,
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

