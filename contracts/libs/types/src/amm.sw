library;

use std::identity::Identity;
use ::structs::PoolId;

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

    #[storage(read)]
    fn get_pool_reserves(pool_id: PoolId) -> (u64, u64);

    #[storage(read)]
    fn get_ramp_state(pool_id: PoolId) -> (AssetId, u64, u64, u64, u8, u8);

    #[storage(read, write)]
    fn configure_ramp(pool_id: PoolId, base_asset: AssetId, x: u64, min_base_trade: u64) -> bool;

    #[storage(read, write)]
    fn consume_ramp_step(pool_id: PoolId) -> bool;
}