library;

use std::identity::Identity;
use ::structs::{PoolId, Pool};

abi AMM {
    #[storage(read, write)]
    fn initialize(owner: Identity);

    #[storage(read, write)]
    fn set_owner(new_owner: Identity);

    #[storage(read, write)]
    fn create_pool(
        token_0: AssetId,
        token_1: AssetId,
    ) -> PoolId;

    #[storage(read, write), payable]
    fn add_liquidity(
        pool_id: PoolId,
        amount_0: u64,
        amount_1: u64,
    ) -> bool;

    #[storage(read, write)]
    fn remove_liquidity(
        pool_id: PoolId,
        amount_0: u64,
        amount_1: u64,
    ) -> bool;

    #[storage(read, write), payable]
    fn swap(
        pool_id: PoolId,
        min_amount_out: u64,
        token_in: AssetId,
    ) -> u64;
}