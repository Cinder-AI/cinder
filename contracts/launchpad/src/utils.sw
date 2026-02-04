library;

use types::campaign::Campaign;

use std::{
    string::String,
    storage::storage_string::*,
    storage::storage_vec::*,
    logging::log,
    auth::msg_sender,
};

use src20::{SetNameEvent, SetSymbolEvent, SetDecimalsEvent};


#[storage(write)]
pub fn set_name(
    name_key: StorageKey<StorageMap<AssetId, StorageString>>, 
    asset: AssetId, 
    name: String
) {
    name_key.insert(asset, StorageString{});
    name_key.get(asset).write_slice(name);

    log(SetNameEvent{
        asset,
        name: Some(name),
        sender: msg_sender().unwrap(),
    });
}

#[storage(write)]
pub fn set_ticker(
    ticker_key: StorageKey<StorageMap<AssetId, StorageString>>, 
    asset: AssetId, 
    ticker: String
) {
    ticker_key.insert(asset, StorageString{});
    ticker_key.get(asset).write_slice(ticker);

    log(SetSymbolEvent{
        asset,
        symbol: Some(ticker),
        sender: msg_sender().unwrap(),
    });
}

#[storage(write)]
pub fn set_decimals(
    decimals_key: StorageKey<StorageMap<AssetId, u8>>, 
    asset: AssetId, 
    decimals: u8
) {
    decimals_key.insert(asset, decimals);
    log(SetDecimalsEvent{
        asset,
        decimals,
        sender: msg_sender().unwrap(),
    });
}

#[storage(write)]
pub fn set_description(
    description_key: StorageKey<StorageMap<AssetId, StorageString>>, 
    asset: AssetId, 
    description: String
) {
    description_key.insert(asset, StorageString{});
    description_key.get(asset).write_slice(description);
}

#[storage(write)]
pub fn set_image(
    image_key: StorageKey<StorageMap<AssetId, StorageString>>,
    asset: AssetId,
    image: String
) {
    image_key.insert(asset, StorageString{});
    image_key.get(asset).write_slice(image);
}

#[storage(write)]
pub fn delete_name(
    name_key: StorageKey<StorageMap<AssetId, StorageString>>, 
    asset: AssetId,
) -> bool {
    name_key.remove(asset)
}

#[storage(write)]
pub fn delete_ticker(
    ticker_key: StorageKey<StorageMap<AssetId, StorageString>>, 
    asset: AssetId,
) -> bool {
    ticker_key.remove(asset)
}

#[storage(write)]
pub fn delete_decimals(
    decimals_key: StorageKey<StorageMap<AssetId, u8>>, 
    asset: AssetId,
) -> bool {
    decimals_key.remove(asset)
}

#[storage(write)]
pub fn delete_description(
    description_key: StorageKey<StorageMap<AssetId, StorageString>>, 
    asset: AssetId,
) -> bool {
    description_key.remove(asset)
}

#[storage(write)]
pub fn delete_image(
    image_key: StorageKey<StorageMap<AssetId, StorageString>>, 
    asset: AssetId,
) -> bool {
    image_key.remove(asset)
}

#[storage(write)]
pub fn delete_campaign(
    campaigns_key: StorageKey<StorageMap<AssetId, Campaign>>, 
    asset: AssetId,
) -> bool {
    campaigns_key.remove(asset)
}

#[storage(read, write)]
pub fn delete_asset(
    assets_key: StorageKey<StorageVec<AssetId>>,
    asset: AssetId,
) -> bool {
    let mut i = 0;
    while i < assets_key.len() {
        let _asset = assets_key.get(i).unwrap().read();
        if _asset == asset {
            let _ = assets_key.remove(i);
            return true;
        }
        i += 1;
    }
    false
}

#[storage(read)]
pub fn get_vec_index(vec: StorageKey<StorageVec<AssetId>>, item: AssetId) -> Option<u64> {
    let mut i = 0;
    while i < vec.len() {
        if vec.get(i).unwrap().read() == item {
            return Some(i);
        }
        i += 1;
    }
    None
}