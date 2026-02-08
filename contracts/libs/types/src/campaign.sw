library;

use std::{
    identity::Identity,
    alias::SubId,
};

use ::bonding::BondingCurve;

pub enum CampaignStatus {
    Active: (),
    Launched: (),
    Denied: (),
    Migrated: (),
}

impl PartialEq for CampaignStatus {
    fn eq(self, other: Self) -> bool {
        match (self, other) {
            (CampaignStatus::Active, CampaignStatus::Active) => true,
            (CampaignStatus::Launched, CampaignStatus::Launched) => true,
            (CampaignStatus::Denied, CampaignStatus::Denied) => true,
            (CampaignStatus::Migrated, CampaignStatus::Migrated) => true,
            _ => false,
        }
    }
}

impl Eq for CampaignStatus {

}

pub struct Campaign {
    pub target: u64,
    pub creator: Identity,
    pub status: CampaignStatus,
    pub token_id: AssetId,
    pub sub_id: SubId,
    pub total_pledged: u64, 
    pub total_supply: u64,
    pub curve: BondingCurve,
    pub amm_reserved: u64,
}