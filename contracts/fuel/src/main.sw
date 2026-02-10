contract;
use src20::{SRC20};
use src3::SRC3;
use src5::{SRC5, State};
use std::{
    asset::{burn, mint_to},
    call_frames::msg_asset_id,
    constants::DEFAULT_SUB_ID,
    context::{msg_amount},
    storage::storage_string::*,
    string::String,
};
use utils::single_asset_helpers::*;

storage {
    initialized: bool = false,
    total_supply: u64 = 0,
    owner: State = State::Uninitialized,
    name: StorageString = StorageString{},
    symbol: StorageString = StorageString{},
    decimals: u8 = 9,
}

abi FuelToken {
    #[storage(read, write)]
    fn initialize(owner: Identity);

    #[storage(read, write)]
    fn set_owner(owner: Identity);
}

impl SRC5 for Contract {
    #[storage(read)]
    fn owner() -> State {
        storage.owner.read()
    }
}

impl SRC20 for Contract {
    #[storage(read)]
    fn total_assets() -> u64 {
        1
    }

    #[storage(read)]
    fn total_supply(asset: AssetId) -> Option<u64> {
        get_total_supply(storage.total_supply, asset, AssetId::default())
    }

    #[storage(read)]
    fn name(asset: AssetId) -> Option<String> {
        get_name(storage.name, asset, AssetId::default())
    }

    #[storage(read)]
    fn symbol(asset: AssetId) -> Option<String> {
        get_symbol(storage.symbol, asset, AssetId::default())
    }

    #[storage(read)]
    fn decimals(asset: AssetId) -> Option<u8> {
        get_decimals(storage.decimals, asset, AssetId::default())
    }
}

impl SRC3 for Contract {
    #[storage(read, write)]
    fn mint(recipient: Identity, sub_id: Option<SubId>, amount: u64) {
        require(sub_id.is_some() && sub_id.unwrap() == DEFAULT_SUB_ID, "Incorrect Sub ID");
        let current_supply = storage.total_supply.read();
        let new_supply = current_supply + amount;
        storage.total_supply.write(new_supply);
        mint_to(recipient, sub_id.unwrap(), amount);
    }

    #[storage(read, write), payable]
    fn burn(sub_id: SubId, amount: u64) {
        require(msg_amount() >= amount, "Incorrect amount provided");
        require(sub_id == DEFAULT_SUB_ID, "Incorrect Sub ID");
        require(msg_asset_id() == AssetId::default(), "Incorrect asset id");

        let current_supply = storage.total_supply.read();
        let new_supply = current_supply - amount;
        storage.total_supply.write(new_supply);
        burn(sub_id, amount);
    }
}

impl FuelToken for Contract {
    #[storage(read, write)]
    fn initialize(owner: Identity) {
        require(!storage.initialized.read(), "Contract already initialized");
        storage.initialized.write(true);
        storage.owner.write(State::Initialized(owner));
        storage.name.write_slice(String::from_ascii_str("Fuel"));
        storage.symbol.write_slice(String::from_ascii_str("FUEL"));
        storage.total_supply.write(0);
    }

    #[storage(read, write)]
    fn set_owner(owner: Identity) {
        storage.owner.write(State::Initialized(owner));
    }
}
