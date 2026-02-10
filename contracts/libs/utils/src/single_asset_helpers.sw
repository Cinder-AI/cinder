library;

use std::storage::storage_key::*;
use std::storage::storage_string::*;
use std::string::String;

#[storage(read)]
pub fn get_total_supply(storage_key: StorageKey<u64>, asset: AssetId, default_asset: AssetId) -> Option<u64> {
    if asset == default_asset {
        Some(storage_key.read())
    } else {
        None
    }
}

#[storage(read)]
pub fn get_name(storage_key: StorageKey<StorageString>, asset: AssetId, default_asset: AssetId) -> Option<String> {
    if asset == default_asset {
        storage_key.read_slice()
    } else {
        None
    }
}

#[storage(read)]
pub fn get_symbol(storage_key: StorageKey<StorageString>, asset: AssetId, default_asset: AssetId) -> Option<String> {
    if asset == default_asset {
        storage_key.read_slice()
    } else {
        None
    }
}

#[storage(read)]
pub fn get_decimals(storage_key: StorageKey<u8>, asset: AssetId, default_asset: AssetId) -> Option<u8> {
    if asset == default_asset {
        Some(storage_key.read())
    } else {
        None
    }
}