library;

use std::{
    string::String,
};
use src7::Metadata;
use src5::State;
use ::structs::{TokenInfo};

abi CinderToken {
    #[storage(read, write)]
    fn initialize(owner: Identity);

    #[storage(read)]
    fn metadata(asset: AssetId, key: String) -> Option<Metadata>;

    #[storage(read)]
    fn total_assets() -> u64;

    #[storage(read)]
    fn total_supply(asset: AssetId) -> Option<u64>;

    #[storage(read)]
    fn name(asset: AssetId) -> Option<String>;

    #[storage(read)]
    fn symbol(asset: AssetId) -> Option<String>;

    #[storage(read)]
    fn decimals(asset: AssetId) -> Option<u8>;

    #[storage(read)]
    fn owner() -> State;

    #[storage(read, write)]
    fn set_owner(owner: Identity);

    #[storage(read, write)]
    fn mint(recipient: Identity, sub_id: Option<SubId>, amount: u64);

    #[storage(read, write), payable]
    fn burn(sub_id: SubId, amount: u64);

    #[storage(read, write)]
    fn set_image(image: String);

    fn default_sub_id() -> SubId;

    fn base_asset() -> AssetId;

    fn default_asset() -> AssetId;

    #[storage(read)]
    fn asset_info(asset: AssetId) -> TokenInfo;
}