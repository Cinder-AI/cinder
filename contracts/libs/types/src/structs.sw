library;

use std::string::String;
use std::identity::Identity;


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
    pub claimed: bool,
}

