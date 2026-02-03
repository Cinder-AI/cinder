library;

use std::{
    identity::Identity,
    string::String,
    alias::SubId,
};
use ::structs::TokenInfo;
use ::campaign::Campaign;

abi Launchpad {
    #[storage(read, write)]
    fn create_campaign(
        name: String,
        ticker: String,
        description: String,
        image: String,
    ) -> AssetId;

    #[storage(read, write), payable]
    fn deny_campaign(asset_id: AssetId) -> bool;

    #[storage(read, write)]
    fn delete_campaign(asset_id: AssetId) -> bool;

    #[storage(read, write)]
    fn launch_campaign(asset_id: AssetId) -> bool;

    #[storage(read, write)]
    fn claim(asset_id: AssetId) -> bool;

    #[storage(read, write), payable]
    fn buy(asset_id: AssetId, amount: u64, max_cost: u64) -> u64;

    #[storage(read, write), payable]
    fn sell(asset_id: AssetId, amount: u64, min_refund: u64) -> u64;

    #[storage(read)]
    fn get_campaign(asset_id: AssetId) -> Campaign;

    #[storage(read, write), payable]
    fn pledge(asset_id: AssetId, amount: u64) -> bool;

    #[storage(read)]
    fn get_campaign_counter() -> u64;

    #[storage(read)]
    fn get_token_info(asset_id: AssetId) -> TokenInfo;

    #[storage(read)]
    fn get_pledge(asset_id: AssetId, sender: Identity) -> u64;

    #[storage(read)]
    fn get_total_pledged(asset_id: AssetId) -> u64;

    #[storage(read)]
    fn get_assets() -> Vec<TokenInfo>;

    #[storage(read)]
    fn get_campaigns() -> Vec<Campaign>;

    #[storage(read, write), payable]
    fn mint(recipient: Identity, sub_id: SubId, amount: u64);
}