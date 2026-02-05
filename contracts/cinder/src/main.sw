contract;

pub mod events;
pub mod structs;

use src3::{SRC3};
use src7::{SRC7, Metadata, SetMetadataEvent};
use src20::{SRC20, TotalSupplyEvent, SetNameEvent, SetSymbolEvent, SetDecimalsEvent};
use src5::{SRC5, State};
use types::cinder::CinderToken;

use std::{
    asset::{burn, mint_to},
    constants::DEFAULT_SUB_ID,
    context::{msg_amount},
    call_frames::{msg_asset_id},
    storage::storage_string::*,
    string::String,
    logging::log,
};

use events::{InitializeEvent, SetImageEvent, SetOwnerEvent};
use structs::AssetInfo;

configurable {
    MAX_SUPPLY: u64 = 1_000_000_000,
    DECIMALS: u8 = 9,
    NAME: str[6] = __to_str_array("Cinder"),
    SYMBOL: str[3] = __to_str_array("CIN"),
}

storage {
    initialized: bool = false,
    image: StorageString = StorageString{},
    total_supply: u64 = 0,
    owner: State = State::Uninitialized, // Launchpad Contract
}


abi EmitSRC20Events {
    #[storage(read)]
    fn emit_src20_events();
}

impl EmitSRC20Events for Contract {
    #[storage(read)]
    fn emit_src20_events() {
        let asset = AssetId::default();
        let sender = msg_sender().unwrap();
        let name = Some(String::from_ascii_str(from_str_array(NAME)));
        let symbol = Some(String::from_ascii_str(from_str_array(SYMBOL)));
        let image = storage.image.read_slice();

        SetNameEvent::new(asset, name, sender).log();
        SetSymbolEvent::new(asset, symbol, sender).log();
        SetDecimalsEvent::new(asset, DECIMALS, sender).log();
        SetImageEvent::new(asset, image, sender).log();
    }
}

#[storage(read)]
fn get_image() -> Option<Metadata> {
    let image = storage.image.read_slice();
    if image.is_some() {
        Some(Metadata::String(image.unwrap()))
    } else {
        None
    }
}

impl CinderToken for Contract {
    #[storage(read, write)]
    fn initialize(owner: Identity) {
        require(!storage.initialized.read(), "Contract already initialized");
        storage.initialized.write(true);
        storage.owner.write(State::Initialized(owner));
        log(InitializeEvent{ owner });
    }

    #[storage(read)]
    fn metadata(asset: AssetId, key: String) -> Option<Metadata> {
        require(asset == AssetId::default(), "Incorrect asset id");

        match key.as_str() {
            "image" => {
                get_image()
            },
            _ => None,

        }

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

    #[storage(read)]
    fn owner() -> State {
        storage.owner.read()
    }

    #[storage(read, write)]
    fn set_owner(owner: Identity) {
        storage.owner.write(State::Initialized(owner));
        log(SetOwnerEvent{ owner });
     }

    #[storage(read, write)]
    fn mint(recipient: Identity, sub_id: Option<SubId>, amount: u64) {
        require(sub_id.is_some() && sub_id.unwrap() == DEFAULT_SUB_ID, "Incorrect Sub ID");
        require(msg_sender().unwrap() == storage.owner.read().unwrap(), "Not authorized");

        let asset_id = AssetId::new(ContractId::this(), DEFAULT_SUB_ID);
        let current_supply = storage.total_supply.read();
        let new_supply = current_supply + amount;
        storage
            .total_supply
            .write(new_supply);

        mint_to(recipient, sub_id.unwrap(), amount);
        TotalSupplyEvent::new(AssetId::default(), new_supply, msg_sender().unwrap()).log();
    }

    #[storage(read, write), payable]
    fn burn(sub_id: SubId, amount: u64) {
        require(sub_id == DEFAULT_SUB_ID, "Incorrect Sub ID");
        require(msg_amount() >= amount, "Incorrect amount provided");
        require(msg_asset_id() == AssetId::default(), "Incorrect asset id");
        require(msg_sender().unwrap() == storage.owner.read().unwrap(), "Not authorized");

        let current_supply = storage.total_supply.read();
        let new_supply = current_supply - amount;
        storage
            .total_supply
            .write(new_supply);

        burn(DEFAULT_SUB_ID, amount);
        TotalSupplyEvent::new(AssetId::default(), new_supply, msg_sender().unwrap()).log();
    }

    fn default_sub_id() -> SubId {
        DEFAULT_SUB_ID
    }

    fn base_asset() -> AssetId {
        AssetId::base()
    }

    fn default_asset() -> AssetId {
        AssetId::default()
    }

    #[storage(read)]
    fn asset_info(asset: AssetId) -> AssetInfo {
        let name = String::from_ascii_str(from_str_array(NAME));
        let symbol = String::from_ascii_str(from_str_array(SYMBOL));
        let decimals = DECIMALS;
        let image = storage.image.read_slice().unwrap_or(String::from_ascii_str(""));
        AssetInfo {
            asset,
            name,
            symbol,
            decimals,
            image,
        }
    }

    #[storage(read, write)]
    fn set_image(image: String) {
        storage.image.write_slice(image);
        
        SetImageEvent::new(AssetId::default(), Some(image), msg_sender().unwrap()).log();
    }
}
