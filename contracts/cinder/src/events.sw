library;

use std::{
    string::String
};

pub struct SetImageEvent {
    pub asset: AssetId,
    pub symbol: Option<String>,
    pub sender: Identity,
}

impl PartialEq for SetImageEvent {
    fn eq(self, other: Self) -> bool {
        self.asset == other.asset && self.symbol == other.symbol && self.sender == other.sender
    }
}

impl SetImageEvent {
    pub fn new(asset: AssetId, symbol: Option<String>, sender: Identity) -> Self {
        Self {
            asset,
            symbol,
            sender,
        }
    }

    pub fn asset(self) -> AssetId {
        self.asset
    }

    pub fn symbol(self) -> Option<String> {
        self.symbol
    }

    pub fn sender(self) -> Identity {
        self.sender
    }

    pub fn log(self) {
        log(self);
    }
}

pub struct SetOwnerEvent {
    pub owner: Identity
}

pub struct InitializeEvent {
    pub owner: Identity
}