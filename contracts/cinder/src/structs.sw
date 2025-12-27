library;

use std::{
    string::String
};

pub struct AssetInfo {
    pub asset: AssetId,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub image: String,
}