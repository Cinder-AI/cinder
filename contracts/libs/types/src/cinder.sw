library;

use std::{
    string::String,
};
use ::structs::{TokenInfo};

abi CinderToken {
    #[storage(read, write)]
    fn initialize(owner: Identity) -> bool;

    #[storage(read, write)]
    fn set_owner(owner: Identity);

    #[storage(read, write)]
    fn set_image(image: String);

    #[storage(read)]
    fn asset_info(asset: AssetId) -> TokenInfo;

    #[storage(read, write)]
    fn mint_cinder(recipient: Identity, amount: u64);

    #[storage(read, write), payable]
    fn burn_cinder(sender: Identity, amount: u64) -> bool;
}