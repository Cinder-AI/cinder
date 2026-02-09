import {
  Campaign,
  CampaignDailyStats,
  CampaignUserDayActivity,
  DailyStats,
  User,
  UserDayActivity,
} from "generated";

export const upsertUser = async (
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

export const upsertCampaign = async (
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

export const upsertDailyStats = async (
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

export const markUserActiveForDay = async (
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

export const upsertCampaignDailyStats = async (
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

export const markCampaignUserActiveForDay = async (
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
