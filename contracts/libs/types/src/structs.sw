library;

use std::string::String;
use std::identity::Identity;

pub struct Pool {
    pub id: PoolId,
    pub reserve_0: u64,
    pub reserve_1: u64,
    pub decimals_0: u8,
    pub decimals_1: u8,
}

impl Pool {
    pub fn new(id: PoolId, decimals_0: u8, decimals_1: u8) -> Self {
        Self { id, reserve_0: 0, reserve_1: 0, decimals_0, decimals_1 }
    }
}

pub type PoolId = (AssetId, AssetId);

pub struct AssetInfo {
    pub asset: AssetId,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub image: String,
}

pub struct TokenInfo {
    pub asset_id: AssetId,
    pub name: String,
    pub ticker: String,
    pub description: String,
    pub image: String,
}

pub struct Pledge {
    pub amount: u64,
    pub sender: Identity,
    pub asset_id: AssetId,
}

