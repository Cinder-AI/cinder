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
use utils::*;

configurable {
    NAME: str[5] = __to_str_array("Fuel7"),
    SYMBOL: str[5] = __to_str_array("$FUEL"),
    DECIMALS: u8 = 9,
}

storage {
    initialized: bool = false,
    total_supply: u64 = 0,
    owner: State = State::Uninitialized,
    decimals: u8 = 9,
    image: StorageString = StorageString{},
}

abi FuelToken {
    #[storage(read, write)]
    fn initialize(owner: Identity);

    #[storage(read, write)]
    fn set_owner(owner: Identity);

    #[storage(read, write)]
    fn set_image(image: String);
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
        if asset == AssetId::default() {
            Some(storage.total_supply.read())
        } else {
            None
        }
    }

    #[storage(read)]
    fn name(asset: AssetId) -> Option<String> {
        if asset == AssetId::default() {
            Some(String::from_ascii_str(from_str_array(NAME)))
        } else {
            None
        }
    }

    #[storage(read)]
    fn symbol(asset: AssetId) -> Option<String> {
        if asset == AssetId::default() {
            Some(String::from_ascii_str(from_str_array(SYMBOL)))
        } else {
            None
        }
    }

    #[storage(read)]
    fn decimals(asset: AssetId) -> Option<u8> {
        if asset == AssetId::default() {
            Some(DECIMALS)
        } else {
            None
        }
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
    }

    #[storage(read, write)]
    fn set_owner(owner: Identity) {
        require_owner(storage.owner.read());
        storage.owner.write(State::Initialized(owner));
    }

    #[storage(read, write)]
    fn set_image(image: String) {
        storage.image.write_slice(image);
    }
}
