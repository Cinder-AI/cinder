 /*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  Cinder,
  Cinder_SetImageEvent,
  Cinder_StrLog,
  Cinder_InitializeEvent,
  Cinder_SetOwnerEvent,
  Cinder_Mint,
  Cinder_Burn,
  Launchpad,
  Launchpad_CampaignLaunchedEvent,
  Launchpad_CampaignMigratedEvent,
  Launchpad_TradeEvent,
  Launchpad_TotalSupplyEvent,
  Launchpad_MintEvent,
  Launchpad_CampaignCreatedEvent,
  Launchpad_PledgedEvent,
  Launchpad_ClaimEvent,
  Launchpad_CampaignDeniedEvent,
  Launchpad_BoostEvent,
  ReactorPool,
  ReactorPool_CreatePoolEvent,
  ReactorPool_MintEvent,
  ReactorPool_SwapEvent,
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

const PRICE_SCALE = 1_000_000_000n;

const identityToId = (identity: { case: "Address" | "ContractId"; payload: { bits: string } }) =>
  identity.payload.bits;

const getCurrentPriceScaledFromVirtualReserves = (
  virtualBaseReserve: bigint,
  virtualTokenReserve: bigint,
) => {
  if (virtualTokenReserve <= 0n) {
    return 0n;
  }
  return (virtualBaseReserve * PRICE_SCALE) / virtualTokenReserve;
};

const getPoolSnapshotKey = (poolId: [{ bits: string }, { bits: string }, bigint]) => {
  const token0AssetId = poolId[0].bits;
  const token1AssetId = poolId[1].bits;
  const fee = poolId[2];
  return {
    poolKey: `${token0AssetId}_${token1AssetId}_${fee.toString()}`,
    token0AssetId,
    token1AssetId,
    fee,
  };
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

Cinder.MintEvent.handler(async ({ event, context }) => {
  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const recipientId = identityToId(event.params.recipient);
  const amount = toHuman(event.params.amount, BASE_ASSET_DECIMALS);
  const entity: Cinder_Mint = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    recipient_id: recipientId,
    amount: amount,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.Cinder_Mint.set(entity);
});

Cinder.BurnEvent.handler(async ({ event, context }) => {
  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const senderId = identityToId(event.params.sender);
  const amount = toHuman(event.params.amount, BASE_ASSET_DECIMALS);
  const entity: Cinder_Burn = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    sender_id: senderId,
    amount: amount,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
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
  console.log('event', event);
  console.log('event.params', event.params);

  const campaignId = event.params.asset_id.bits;
  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const curveSupply = event.params.curve_supply;
    const curveReserve = event.params.curve_reserve;
    const curveMaxSupply = event.params.curve_max_supply;
    const curveSoldSupply = event.params.users_share;
    const virtualBaseReserve = event.params.virtual_base_reserve;
    const virtualTokenReserve = event.params.virtual_token_reserve;
    const currentPriceScaled = getCurrentPriceScaledFromVirtualReserves(
      virtualBaseReserve,
      virtualTokenReserve,
    );
    const currentPrice = currentPriceScaled / PRICE_SCALE;
    const updatedCampaign: Campaign = {
      ...campaign,
      status: "Launched",
      virtual_base_reserve: virtualBaseReserve,
      virtual_token_reserve: virtualTokenReserve,
      curve_max_supply: curveMaxSupply,
      curve_supply: curveSupply,
      curve_sold_supply: curveSoldSupply,
      curve_reserve: curveReserve,
      current_price_scaled: currentPriceScaled,
      current_price: currentPrice,
    };
    context.Campaign.set(updatedCampaign);
  }
});

Launchpad.CampaignMigratedEvent.handler(async ({ event, context }) => {
  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const campaignId = event.params.asset_id.bits;
  const senderId = identityToId(event.params.sender);
  const fuelReserve = event.params.fuel_reserve;
  const entity: Launchpad_CampaignMigratedEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    campaign_id: campaignId,
    sender_id: senderId,
    fuel_reserve: fuelReserve,
    token_reserve: event.params.token_reserve,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };

  context.Launchpad_CampaignMigratedEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      status: "Migrated",
      curve_reserve: 0n,
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
  // Keep creator profile fresh, but do not count campaign creation as market activity.
  // This prevents synthetic inflation of campaign unique users/actions at creation time.
  await upsertUser(context, creatorId, timestamp, 0n, 0n);

  const humanTarget = toHuman(event.params.target, BASE_ASSET_DECIMALS);
  await upsertCampaign(context, campaignId, {
    creator_id: creatorId,
    created_at: timestamp,
    target: humanTarget,
    total_pledged: 0n,
    total_volume_base: 0n,
    status: "Active",
    name: tokenInfo.name,
    ticker: tokenInfo.ticker,
    description: tokenInfo.description,
    decimals: tokenInfo.decimals,
    image: tokenInfo.image,
    virtual_base_reserve: 0n,
    virtual_token_reserve: 0n,
    curve_max_supply: 0n,
    curve_supply: 0n,
    curve_sold_supply: 0n,
    current_price_scaled: 0n,
    current_price: 0n,
    curve_reserve: 0n,
    has_boost: false,
    boost_multiplier_x1e6: 0n,
    boost_duration_secs: 0n,
    boost_burned_at: 0n,
    boost_ends_at: 0n,
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
  await upsertUser(context, userId, timestamp, 1n, humanPledgeAmount);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, humanPledgeAmount, humanPledgeAmount);
  await markCampaignUserActiveForDay(context, campaignId, userId, dayId, dayStart, timestamp);
  await upsertCampaignDailyStats(
    context,
    campaignId,
    dayId,
    dayStart,
    1n,
    humanPledgeAmount,
    humanPledgeAmount,
  );

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
      total_volume_base: campaign.total_volume_base + humanPledgeAmount,
    };
    context.Campaign.set(updatedCampaign);
  }
});

Launchpad.ClaimEvent.handler(async ({ event, context }) => {
  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const campaignId = event.params.asset_id.bits;
  const senderId = identityToId(event.params.sender);
  const humanAmount = toHuman(event.params.amount, BASE_ASSET_DECIMALS);
  const entity: Launchpad_ClaimEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    campaign_id: campaignId,
    sender_id: senderId,
    amount: humanAmount,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };

  context.Launchpad_ClaimEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const userId = identityToId(event.params.sender);
  const dayId = getDayId(timestamp);
  const dayStart = getDayStart(timestamp);
  await upsertUser(context, userId, timestamp, 1n, 0n);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, 0n, 0n);
});

Launchpad.CampaignDeniedEvent.handler(async ({ event, context }) => {
  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const campaignId = event.params.asset_id.bits;
  const senderId = identityToId(event.params.sender);
  const entity: Launchpad_CampaignDeniedEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    campaign_id: campaignId,
    sender_id: senderId,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };

  context.Launchpad_CampaignDeniedEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    const updatedCampaign: Campaign = {
      ...campaign,
      status: "Denied",
    };
    context.Campaign.set(updatedCampaign);
  }
});

Launchpad.BoostEvent.handler(async ({ event, context }) => {
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const campaignId = event.params.asset_id.bits;
  const creatorId = identityToId(event.params.creator);
  const burnAmount = toHuman(event.params.burn_amount, BASE_ASSET_DECIMALS);

  const entity: Launchpad_BoostEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    campaign_id: campaignId,
    creator_id: creatorId,
    burn_amount: burnAmount,
    burned_at: event.params.burned_at,
    boost_multiplier_x1e6: event.params.boost_multiplier_x1e6,
    duration_secs: event.params.duration_secs,
    ends_at: event.params.ends_at,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.Launchpad_BoostEvent.set(entity);

  if (context.isPreload) {
    return;
  }

  const campaign = await context.Campaign.get(campaignId);
  if (!campaign) {
    return;
  }

  const updatedCampaign: Campaign = {
    ...campaign,
    has_boost: true,
    boost_multiplier_x1e6: event.params.boost_multiplier_x1e6,
    boost_duration_secs: event.params.duration_secs,
    boost_burned_at: event.params.burned_at,
    boost_ends_at: event.params.ends_at,
  };
  context.Campaign.set(updatedCampaign);
});

ReactorPool.CreatePoolEvent.handler(async ({ event, context }) => {
  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const { poolKey, token0AssetId, token1AssetId, fee } = getPoolSnapshotKey(event.params.pool_id);
  const entity: ReactorPool_CreatePoolEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    pool_id: poolKey,
    token_0_asset_id: token0AssetId,
    token_1_asset_id: token1AssetId,
    fee,
    sqrt_price_x96: event.params.sqrt_price_x96,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.ReactorPool_CreatePoolEvent.set(entity);
});

ReactorPool.MintEvent.handler(async ({ event, context }) => {
  const entity: ReactorPool_MintEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
  };
  context.ReactorPool_MintEvent.set(entity);
});

ReactorPool.SwapEvent.handler(async ({ event, context }) => {
  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const { poolKey, token0AssetId, token1AssetId, fee } = getPoolSnapshotKey(event.params.pool_id);
  const { pool_state: poolState } = event.params;
  const entity: ReactorPool_SwapEvent = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    pool_id: poolKey,
    token_0_asset_id: token0AssetId,
    token_1_asset_id: token1AssetId,
    fee,
    recipient_id: identityToId(event.params.recipient),
    asset_0_in: event.params.asset_0_in,
    asset_1_in: event.params.asset_1_in,
    asset_0_out: event.params.asset_0_out,
    asset_1_out: event.params.asset_1_out,
    sqrt_price_x96: poolState.sqrtPriceX96,
    tick: poolState.tick.underlying,
    fee_protocol_0: poolState.fee_protocol_0,
    fee_protocol_1: poolState.fee_protocol_1,
    unlocked: poolState.unlocked,
    fee_growth_global_0_x128: poolState.feeGrowthGlobal0X128,
    fee_growth_global_1_x128: poolState.feeGrowthGlobal1X128,
    protocol_fees_token_0: poolState.protocolFees.token0,
    protocol_fees_token_1: poolState.protocolFees.token1,
    liquidity: poolState.liquidity,
    reserve_0: poolState.reserve_0,
    reserve_1: poolState.reserve_1,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.ReactorPool_SwapEvent.set(entity);
});

Launchpad.TradeEvent.handler(async ({ event, context }) => {
  const timestamp = getTimestamp(event);
  const blockHeight = getBlockHeight(event);
  const txId = getTxId(event);
  const campaignId = event.params.asset_id.bits;
  const userId = identityToId(event.params.sender);
  const tradeType = event.params.trade_type.case; // "Buy" or "Sell"
  const side = tradeType.toLowerCase(); // "buy" or "sell"
  const dayId = getDayId(timestamp);
  const dayStart = getDayStart(timestamp);

  if (context.isPreload) {
    return;
  }

  const campaign = await context.Campaign.get(campaignId);
  const tokenDecimals = campaign?.decimals ?? 0;
  const humanAmountToken = toHuman(event.params.token_amount, tokenDecimals);
  const humanAmountFuel = toHuman(event.params.fuel_amount, BASE_ASSET_DECIMALS);
  
  // For sell operations, fuel_amount is payout (positive), but we track volume as negative for sells
  const volumeChange = side === "buy" ? humanAmountFuel : -humanAmountFuel;
  
  await upsertUser(context, userId, timestamp, 1n, humanAmountFuel);
  await markUserActiveForDay(context, userId, dayId, dayStart, timestamp);
  await upsertDailyStats(context, dayId, dayStart, 1n, humanAmountFuel, volumeChange);
  await markCampaignUserActiveForDay(context, campaignId, userId, dayId, dayStart, timestamp);
  await upsertCampaignDailyStats(
    context,
    campaignId,
    dayId,
    dayStart,
    1n,
    humanAmountFuel,
    volumeChange,
  );

  const virtualBaseReserve = event.params.virtual_base_reserve;
  const virtualTokenReserve = event.params.virtual_token_reserve;
  const currentPriceScaled = campaign
    ? getCurrentPriceScaledFromVirtualReserves(virtualBaseReserve, virtualTokenReserve)
    : 0n;
  const currentPrice = currentPriceScaled / PRICE_SCALE;
  const curveReserve = event.params.curve_reserve;
  
  const trade: Trade = {
    id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    user_id: userId,
    campaign_id: campaignId,
    side,
    token_amount: humanAmountToken,
    token_amount_raw: event.params.token_amount,
    fuel_amount: humanAmountFuel,
    fuel_amount_raw: event.params.fuel_amount,
    curve_supply: event.params.curve_supply,
    curve_reserve: curveReserve,
    virtual_base_reserve: virtualBaseReserve,
    virtual_token_reserve: virtualTokenReserve,
    timestamp,
    tx_id: txId,
    block_height: blockHeight,
  };
  context.Trade.set(trade);

  if (campaign && currentPriceScaled !== undefined && currentPrice !== undefined) {
    const updatedCampaign: Campaign = {
      ...campaign,
      total_volume_base: campaign.total_volume_base + humanAmountFuel,
      virtual_base_reserve: virtualBaseReserve,
      virtual_token_reserve: virtualTokenReserve,
      curve_sold_supply: event.params.curve_supply,
      current_price_scaled: currentPriceScaled,
      current_price: currentPrice,
      curve_reserve: curveReserve,
    };
    context.Campaign.set(updatedCampaign);
  }
});