library;

use std::{
    string::String,
};
use ::structs::{TokenInfo};

abi CinderToken {
    #[storage(read, write)]
    fn initialize(owner: Identity);

    #[storage(read, write)]
    fn set_owner(owner: Identity);

    #[storage(read, write)]
    fn set_image(image: String);

    #[storage(read)]
    fn asset_info(asset: AssetId) -> TokenInfo;
}