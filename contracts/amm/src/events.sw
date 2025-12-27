library;

use std::identity::Identity;

pub struct InitializeEvent {
    pub owner: Identity,
}

pub struct SetOwnerEvent {
    pub new_owner: Identity,
}