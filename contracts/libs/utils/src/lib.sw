library;

pub mod single_asset_helpers;

use src5::State;
use std::identity::Identity;

pub fn identity_bits(sender: Identity) -> b256 {
    match sender {
        Identity::Address(addr) => addr.into(),
        Identity::ContractId(id) => id.into(),
    }
}

pub fn u256_to_u64(val: u256) -> u64 {
    let (a, b, c, d): (u64, u64, u64, u64) = asm(r1: val) {
        r1: (u64, u64, u64, u64)
    };
    assert(a == 0);
    assert(b == 0);
    assert(c == 0);
    d
}

pub fn require_owner(owner: State) {
    match owner {
        State::Initialized(owner_state) => {
            require(owner_state == msg_sender().unwrap(), "Not owner");
        }
        _ => {
            require(false, "Owner not initialized");
        }
    }
}