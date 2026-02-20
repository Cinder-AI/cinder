library;
use types::structs::TokenInfo;

use std::{
    identity::Identity,
    alias::SubId,
};

pub struct CampaignCreatedEvent {
    pub asset_id: AssetId,
    pub creator: Identity,
    pub sub_id: SubId,
    pub target: u64,
    pub token_info: TokenInfo,
}

pub struct CampaignDeniedEvent {
    pub asset_id: AssetId,
    pub sender: Identity,
}

pub struct CampaignDeletedEvent {
    pub asset_id: AssetId,
    pub sender: Identity,
}

pub struct CampaignLaunchedEvent {
    pub asset_id: AssetId,
    pub sender: Identity,
    pub users_share: u64,
    pub remaining_supply: u64,
    pub amm_supply: u64,
    pub base_price: u64,
    pub slope: u64,
    pub max_supply: u64,
    pub curve_reserve: u64, // FUEL
}

pub struct CampaignMigratedEvent {
    pub asset_id: AssetId,
    pub sender: Identity,
    pub base_reserve: u64, // FUEL
    pub token_reserve: u64,
}

pub struct PledgedEvent {
    pub asset_id: AssetId,
    pub sender: Identity,
    pub amount: u64,
    pub total_pledged: u64,
}

pub struct ClaimEvent {
    pub asset_id: AssetId,
    pub sender: Identity,
    pub amount: u64,
}

pub struct BuyEvent {
    pub asset_id: AssetId,
    pub sender: Identity,
    pub amount: u64,
    pub cost: u64,
    pub sold_supply: u64,
    pub curve_reserve: u64, // FUEL
}

pub struct SellEvent {
    pub asset_id: AssetId,
    pub sender: Identity,
    pub amount: u64,
    pub payout: u64,
    pub sold_supply: u64,
    pub curve_reserve: u64, // FUEL
}

pub struct MintEvent {
    pub asset_id: AssetId,
    pub recipient: Identity,
    pub amount: u64,
}

pub struct BurnEvent {
    pub asset_id: AssetId,
    pub sender: Identity,
    pub amount: u64,
}

pub struct BoostEvent {
    pub asset_id: AssetId,
    pub creator: Identity,
    pub burn_amount: u64,
    pub burned_at: u64,
    pub boost_power_x1e6: u64,
    pub duration_secs: u64,
    pub ends_at: u64,
}
