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
    fn mint(recipient: Identity, amount: u64);

    #[storage(read, write), payable]
    fn burn(amount: u64);   
}

impl FuelToken for Contract {
    #[storage(read, write)]
    fn initialize(owner: Identity) {
        require(!storage.initialized.read(), "Contract already initialized");
        storage.initialized.write(true);
        storage.owner.write(State::Initialized(owner));
        storage.name.write_slice(String::from_ascii_str("Fuel"));
        storage.symbol.write_slice(String::from_ascii_str("FUEL"));
    }

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
            storage.name.read_slice()
        } else {
            None
        }
    }

    #[storage(read)]
    fn symbol(asset: AssetId) -> Option<String> {
        if asset == AssetId::default() {
            storage.symbol.read_slice()
        } else {
            None
        }
    }

    #[storage(read)]
    fn decimals(asset: AssetId) -> Option<u8> {
        if asset == AssetId::default() {
            Some(storage.decimals.read())
        } else {
            None
        }
    }

    #[storage(read)]
    fn owner() -> State {
        storage.owner.read()
    }

    #[storage(read, write)]
    fn set_owner(owner: Identity) {
        storage.owner.write(State::Initialized(owner));
    }

    #[storage(read, write)]
    fn mint(recipient: Identity, amount: u64) {
        let asset_id = AssetId::new(ContractId::this(), DEFAULT_SUB_ID);
        let current_supply = storage.total_supply.read();
        let new_supply = current_supply + amount;
        storage
            .total_supply
            .write(new_supply);
        mint_to(recipient, DEFAULT_SUB_ID, amount);
    }

    #[storage(read, write), payable]
    fn burn(amount: u64) {
        require(msg_amount() >= amount, "Incorrect amount provided");
        require(msg_asset_id() == AssetId::default(), "Incorrect asset id");

        let current_supply = storage.total_supply.read();
        let new_supply = current_supply - amount;
        storage.total_supply.write(new_supply);
        burn(DEFAULT_SUB_ID, amount);
    }
}

#[storage(read)]
fn require_owner() {
    match storage.owner.read() {
        State::Initialized(owner) => {
            require(owner == msg_sender().unwrap(), "Not owner");
        }
        _ => {
            require(false, "Owner not initialized");
        }
    }
}