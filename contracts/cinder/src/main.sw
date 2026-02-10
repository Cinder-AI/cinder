contract;

pub mod events;

use src3::{SRC3};
use src7::{SRC7, Metadata, SetMetadataEvent};
use src20::{SRC20, TotalSupplyEvent, SetNameEvent, SetSymbolEvent, SetDecimalsEvent};
use src5::{SRC5, State};
use types::cinder::CinderToken;
use types::structs::TokenInfo;
use utils::single_asset_helpers::*;
use utils::utils::*;

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
    name: StorageString = StorageString{},
    symbol: StorageString = StorageString{},
    decimals: u8 = 9,
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
        let name = storage.name.read_slice();
        let symbol = storage.symbol.read_slice();
        let image = storage.image.read_slice();
        let decimals = storage.decimals.read();

        SetNameEvent::new(asset, name, sender).log();
        SetSymbolEvent::new(asset, symbol, sender).log();
        SetDecimalsEvent::new(asset, decimals, sender).log();
        SetImageEvent::new(asset, image, sender).log();
    }
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

impl SRC7 for Contract {
    #[storage(read)]
    fn metadata(asset: AssetId, key: String) -> Option<Metadata> {
        if asset == AssetId::default() {
            match key.as_str() {
                "image" => {
                    Some(Metadata::String(storage.image.read_slice().unwrap()))
                },
                _ => None,
            }
        } else {
            None
        }
    }
}

impl SRC3 for Contract {
    #[storage(read, write)]
    fn mint(recipient: Identity, sub_id: Option<SubId>, amount: u64) {
        require_owner(storage.owner.read());
        require(sub_id.is_some() && sub_id.unwrap() == DEFAULT_SUB_ID, "Incorrect Sub ID");

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
        require_owner(storage.owner.read());
        require(sub_id == DEFAULT_SUB_ID, "Incorrect Sub ID");
        require(msg_amount() >= amount, "Incorrect amount provided");
        require(msg_asset_id() == AssetId::default(), "Incorrect asset id");

        let current_supply = storage.total_supply.read();
        let new_supply = current_supply - amount;
        storage
            .total_supply
            .write(new_supply);

        burn(DEFAULT_SUB_ID, amount);
        TotalSupplyEvent::new(AssetId::default(), new_supply, msg_sender().unwrap()).log();
    }
}



impl CinderToken for Contract {
    #[storage(read, write)]
    fn initialize(owner: Identity) {
        require(!storage.initialized.read(), "Contract already initialized");
        storage.initialized.write(true);
        storage.owner.write(State::Initialized(owner));
        log(InitializeEvent{ owner });

        storage.name.write_slice(String::from_ascii_str(from_str_array(NAME)));
        storage.symbol.write_slice(String::from_ascii_str(from_str_array(SYMBOL)));
        storage.decimals.write(DECIMALS);
    }

    #[storage(read, write)]
    fn set_owner(owner: Identity) {
        storage.owner.write(State::Initialized(owner));
        log(SetOwnerEvent{ owner });
     }


    #[storage(read)]
    fn asset_info(asset: AssetId) -> TokenInfo {
        let name = storage.name.read_slice().unwrap_or(String::from_ascii_str(""));
        let symbol = storage.symbol.read_slice().unwrap_or(String::from_ascii_str(""));
        let decimals = storage.decimals.read();
        let image = storage.image.read_slice().unwrap_or(String::from_ascii_str(""));
        TokenInfo {
            asset_id: asset,
            name: name,
            ticker: symbol,
            description: String::from_ascii_str(""),
            decimals: decimals,
            image: image,
        }
    }

    #[storage(read, write)]
    fn set_image(image: String) {
        storage.image.write_slice(image);
        
        SetImageEvent::new(AssetId::default(), Some(image), msg_sender().unwrap()).log();
    }
}
