library;

use std::identity::Identity;
use ::codec::*;

pub fn identity_bits(sender: Identity) -> b256 {
    match sender {
        Identity::Address(addr) => addr.into(),
        Identity::ContractId(id) => id.into(),
    }
}

