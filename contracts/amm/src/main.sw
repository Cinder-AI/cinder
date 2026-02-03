contract;

pub mod events;

use std::{
    asset::transfer,
    context::{
        msg_amount,
        this_balance,
    },
    call_frames::msg_asset_id,
    auth::msg_sender,
    storage::storage_map::*,
    constants::ZERO_B256,
    identity::Identity,
};

storage {
    pools: StorageMap<PoolId, Pool> = StorageMap {},
    owner: Option<Identity> = None,
    initialized: bool = false,
}

use types::{amm::AMM, structs::{PoolId, Pool}};
use events::{InitializeEvent, SetOwnerEvent};

#[storage(read)]
fn require_only_owner() {
    require(storage.initialized.read(), "Contract not initialized");
    require(storage.owner.read().is_some(), "Owner not set");
    require(storage.owner.read().unwrap() == msg_sender().unwrap(), "Only owner can call this");
}

#[storage(read)]
fn require_pool(pool_id: PoolId) -> Pool {
    require(pool_id.0 != pool_id.1, "Identical tokens");
    let p = storage.pools.get(pool_id).try_read();
    require(p.is_some(), "Pool does not exist");
    let pool = p.unwrap();
    require(pool.id == pool_id, "Pool id mismatch");
    pool
}

fn require_reserves_backed(pool_id: PoolId, reserve_0: u64, reserve_1: u64) {
    let bal0 = this_balance(pool_id.0);
    let bal1 = this_balance(pool_id.1);
    require(bal0 >= reserve_0, "Reserve0 > balance0");
    require(bal1 >= reserve_1, "Reserve1 > balance1");
}

impl AMM for Contract {
    #[storage(read, write)]
    fn initialize(owner: Identity) {
        require(!storage.initialized.read(), "Contract already initialized");
        storage.initialized.write(true);
        storage.owner.write(Some(owner));
        log(InitializeEvent{ owner });
    }

    #[storage(read, write)]
    fn set_owner(new_owner: Identity) {
        require(storage.initialized.read(), "Contract not initialized");
        require(storage.owner.read().is_some(), "Owner not set");
        require(storage.owner.read().unwrap() == msg_sender().unwrap(), "Only owner can call this");

        storage.owner.write(Some(new_owner));
        log(SetOwnerEvent{ new_owner });
    }

    #[storage(read, write)]
    fn create_pool(token_0: AssetId, token_1: AssetId) -> PoolId {
        require(storage.initialized.read(), "Contract not initialized");
        require(storage.owner.read().is_some(), "Owner not set");
        require(storage.owner.read().unwrap() == msg_sender().unwrap(), "Only owner can call this");
        require(token_0 != token_1, "Identical tokens");

        let pool_id = (token_0, token_1);
        require(storage.pools.get(pool_id).try_read().is_none(), "Pool already exists");
        storage.pools.insert(pool_id, Pool::new(pool_id, 9, 9));
        pool_id
    }

    #[storage(read, write), payable]
    fn add_liquidity(pool_id: PoolId, amount_0: u64, amount_1: u64) -> bool {
        require_only_owner();
        require(amount_0 > 0 && amount_1 > 0, "Amounts must be > 0");

        let mut p = require_pool(pool_id);
        require_reserves_backed(pool_id, p.reserve_0, p.reserve_1);

        let bal0 = this_balance(pool_id.0);
        let bal1 = this_balance(pool_id.1);
        require(bal0 - p.reserve_0 >= amount_0, "Insufficient token 0");
        require(bal1 - p.reserve_1 >= amount_1, "Insufficient token 1");

        let new_r0 = p.reserve_0 + amount_0;
        let new_r1 = p.reserve_1 + amount_1;
        require(new_r0 >= p.reserve_0, "Overflow reserve_0");
        require(new_r1 >= p.reserve_1, "Overflow reserve_1");

        p.reserve_0 = new_r0;
        p.reserve_1 = new_r1;
        storage.pools.insert(pool_id, p);

        true
    }

    #[storage(read, write)]
    fn remove_liquidity(pool_id: PoolId, amount_0: u64, amount_1: u64) -> bool {
        require_only_owner();
        require(amount_0 > 0 && amount_1 > 0, "Amounts must be > 0");

        let mut p = require_pool(pool_id);
        require_reserves_backed(pool_id, p.reserve_0, p.reserve_1);

        require(p.reserve_0 >= amount_0, "Insufficient reserve 0");
        require(p.reserve_1 >= amount_1, "Insufficient reserve 1");

        let bal0 = this_balance(pool_id.0);
        let bal1 = this_balance(pool_id.1);
        require(bal0 >= amount_0, "Insufficient token 0 balance");
        require(bal1 >= amount_1, "Insufficient token 1 balance");

        p.reserve_0 = p.reserve_0 - amount_0;
        p.reserve_1 = p.reserve_1 - amount_1;
        storage.pools.insert(pool_id, p);

        let owner = storage.owner.read().unwrap();
        transfer(owner, pool_id.0, amount_0);
        transfer(owner, pool_id.1, amount_1);
        true
    }

    #[storage(read, write), payable]
    fn swap(pool_id: PoolId, min_amount_out: u64, token_in: AssetId) -> u64 {
        require(storage.initialized.read(), "Contract not initialized");

        let mut pool_data = require_pool(pool_id);
        require_reserves_backed(pool_id, pool_data.reserve_0, pool_data.reserve_1);
        
        // Определение направления свапа
        require(token_in == pool_id.0 || token_in == pool_id.1, "Invalid token_in");
        
        let (reserve_in, reserve_out, token_out) = if token_in == pool_id.0 {
            (pool_data.reserve_0, pool_data.reserve_1, pool_id.1)
        } else {
            (pool_data.reserve_1, pool_data.reserve_0, pool_id.0)
        };
        
        let amount_in = msg_amount();
        require(amount_in > 0, "Amount in must be greater than 0");
        require(msg_asset_id() == token_in, "Wrong asset sent");

        require(reserve_in > 0 && reserve_out > 0, "Insufficient liquidity");

        let bal_in = this_balance(token_in);
        let bal_out = this_balance(token_out);
        require(bal_in >= reserve_in + amount_in, "Input not received");
        require(bal_out >= reserve_out, "Reserve_out > balance_out");

        let amount_out = get_amount_out(amount_in, reserve_in, reserve_out, LP_FEE_BPS);
        require(amount_out >= min_amount_out, "Insufficient output amount");
        require(amount_out > 0, "Zero output");
        require(amount_out <= reserve_out, "Insufficient liquidity");

        // Обновление резервов
        if token_in == pool_id.0 {
            pool_data.reserve_0 = reserve_in + amount_in;
            pool_data.reserve_1 = reserve_out - amount_out;
        } else {
            pool_data.reserve_0 = reserve_out - amount_out;
            pool_data.reserve_1 = reserve_in + amount_in;
        }
        storage.pools.insert(pool_id, pool_data);
        
        // Перевод выходного токена пользователю
        let to = msg_sender().unwrap();
        transfer(to, token_out, amount_out);
        
        amount_out
    }
}


// pub type PoolId = (AssetId, AssetId);

// /// Структура пула с резервами и decimals
// pub struct Pool {
//     pub reserve_0: u64,
//     pub reserve_1: u64,
//     pub decimals_0: u8,
//     pub decimals_1: u8,
// }

// impl Pool {
//     pub fn new(decimals_0: u8, decimals_1: u8) -> Self {
//         Self {
//             reserve_0: 0,
//             reserve_1: 0,
//             decimals_0,
//             decimals_1,
//         }
//     }
// }

// configurable {
//     /// Комиссия ликвидности в basis points (0.3%)
//     LP_FEE_BPS: u64 = 30,
//     /// Минимальная ликвидность при создании пула
//     MINIMUM_LIQUIDITY: u64 = 1000,
// }

const BASIS_POINTS_DENOMINATOR: u64 = 10000;
const LP_FEE_BPS: u64 = 30;

// fn calculate_fee(amount: u64, fee_bps: u64) -> u64 {
//     let numerator = amount.as_u256() * fee_bps.as_u256();
//     let fee = u64::try_from(numerator / BASIS_POINTS_DENOMINATOR.as_u256()).unwrap();
//     if numerator % BASIS_POINTS_DENOMINATOR.as_u256() != 0 {
//         fee + 1
//     } else {
//         fee
//     }
// }

fn get_amount_out(amount_in: u64, reserve_in: u64, reserve_out: u64, fee_bps: u64) -> u64 {
    require(amount_in > 0, "Insufficient input amount");
    require(reserve_in > 0 && reserve_out > 0, "Insufficient liquidity");
    
    let amount_in_with_fee = amount_in.as_u256() * (BASIS_POINTS_DENOMINATOR - fee_bps).as_u256();
    let numerator = amount_in_with_fee * reserve_out.as_u256();
    let denominator = reserve_in.as_u256() * BASIS_POINTS_DENOMINATOR.as_u256() + amount_in_with_fee;
    
    u64::try_from(numerator / denominator).unwrap()
}

// fn validate_constant_product(
//     reserve_0: u64,
//     reserve_1: u64,
//     new_reserve_0: u64,
//     new_reserve_1: u64,
// ) {
//     let old_k = reserve_0.as_u256() * reserve_1.as_u256();
//     let new_k = new_reserve_0.as_u256() * new_reserve_1.as_u256();
//     require(new_k >= old_k, "Constant product invariant violated");
// }

// storage {
//     pools: StorageMap<PoolId, Pool> = StorageMap {},
//     owner: Option<Identity> = None,
// }

// #[storage(read)]
// fn get_pool(pool_id: PoolId) -> Option<Pool> {
//     storage.pools.get(pool_id).try_read()
// }

// fn normalize_pool_id(token_0: AssetId, token_1: AssetId) -> PoolId {
//     let token_0_b256: b256 = token_0.into();
//     let token_1_b256: b256 = token_1.into();
//     if token_0_b256 < token_1_b256 {
//         (token_0, token_1)
//     } else {
//         (token_1, token_0)
//     }
// }

// #[storage(read)]
// fn only_owner() {
//     let sender = msg_sender().unwrap();
//     let owner = storage.owner.read();
//     require(owner.is_some(), "Owner not set");
//     require(owner.unwrap() == sender, "Only owner can call this");
// }

// fn get_token_decimals(asset_id: AssetId) -> u8 {
//     9
// }

// abi AMM {
//     #[storage(read, write)]
//     fn set_owner(new_owner: Identity);

//     #[storage(read, write)]
//     fn create_pool(
//         token_0: AssetId,
//         token_1: AssetId,
//     ) -> PoolId;

//     #[storage(read, write)]
//     fn add_liquidity(
//         pool_id: PoolId,
//         amount_0: u64,
//         amount_1: u64,
//     ) -> bool;

//     #[storage(read, write)]
//     fn remove_liquidity(
//         pool_id: PoolId,
//         amount_0: u64,
//         amount_1: u64,
//     ) -> bool;

//     #[payable]
//     #[storage(read, write)]
//     fn swap(
//         pool_id: PoolId,
//         min_amount_out: u64,
//         token_in: AssetId,
//     ) -> u64;

//     #[storage(read)]
//     fn get_pool_info(pool_id: PoolId) -> Option<Pool>;
// }

// impl AMM for Contract {
//     #[storage(read, write)]
//     fn set_owner(new_owner: Identity) {
//         let current_owner = storage.owner.read();
//         if current_owner.is_none() {
//             // Первая установка владельца - может быть вызвана любым
//             storage.owner.write(Some(new_owner));
//         } else {
//             // Изменение владельца - только текущий владелец
//             only_owner();
//             storage.owner.write(Some(new_owner));
//         }
//     }

//     #[storage(read)]
//     fn get_pool_info(pool_id: PoolId) -> Option<Pool> {
//         get_pool(pool_id)
//     }

//     #[storage(read, write)]
//     fn create_pool(
//         token_0: AssetId,
//         token_1: AssetId,
//     ) -> PoolId {
//         require(token_0 != token_1, "Identical tokens");
        
//         // Нормализация порядка токенов
//         let pool_id = normalize_pool_id(token_0, token_1);
        
//         // Проверка что пул не существует
//         require(get_pool(pool_id).is_none(), "Pool already exists");
        
//         // Получение decimals из токенов (или дефолт 9)
//         let decimals_0 = get_token_decimals(pool_id.0);
//         let decimals_1 = get_token_decimals(pool_id.1);
        
//         // Создание записи Pool с нулевыми резервами
//         let pool = Pool::new(decimals_0, decimals_1);
//         storage.pools.insert(pool_id, pool);
        
//         pool_id
//     }

//     #[storage(read, write)]
//     fn add_liquidity(
//         pool_id: PoolId,
//         amount_0: u64,
//         amount_1: u64,
//     ) -> bool {
//         only_owner();
        
//         require(amount_0 > 0 && amount_1 > 0, "Amounts must be greater than 0");
        
//         let mut pool = get_pool(pool_id);
//         require(pool.is_some(), "Pool does not exist");
//         let mut pool_data = pool.unwrap();
        
//         let balance_0 = this_balance(pool_id.0);
//         let balance_1 = this_balance(pool_id.1);
        
//         require(balance_0 >= pool_data.reserve_0 + amount_0, "Insufficient token 0");
//         require(balance_1 >= pool_data.reserve_1 + amount_1, "Insufficient token 1");
        
//         let new_reserve_0 = pool_data.reserve_0 + amount_0;
//         let new_reserve_1 = pool_data.reserve_1 + amount_1;
        
//         pool_data.reserve_0 = new_reserve_0;
//         pool_data.reserve_1 = new_reserve_1;
//         storage.pools.insert(pool_id, pool_data);
        
//         true
//     }

//     #[storage(read, write)]
//     fn remove_liquidity(
//         pool_id: PoolId,
//         amount_0: u64,
//         amount_1: u64,
//     ) -> bool {
//         only_owner();
        
//         require(amount_0 > 0 && amount_1 > 0, "Amounts must be greater than 0");
        
//         let mut pool = get_pool(pool_id);
//         require(pool.is_some(), "Pool does not exist");
//         let mut pool_data = pool.unwrap();
        
//         require(pool_data.reserve_0 >= amount_0, "Insufficient reserve 0");
//         require(pool_data.reserve_1 >= amount_1, "Insufficient reserve 1");
        
//         pool_data.reserve_0 = pool_data.reserve_0 - amount_0;
//         pool_data.reserve_1 = pool_data.reserve_1 - amount_1;
//         storage.pools.insert(pool_id, pool_data);
        
//         let owner = storage.owner.read().unwrap();
//         transfer(owner, pool_id.0, amount_0);
//         transfer(owner, pool_id.1, amount_1);
        
//         true
//     }

//     #[payable]
//     #[storage(read, write)]
//     fn swap(
//         pool_id: PoolId,
//         min_amount_out: u64,
//         token_in: AssetId,
//     ) -> u64 {
//         let mut pool = get_pool(pool_id);
//         require(pool.is_some(), "Pool does not exist");
//         let mut pool_data = pool.unwrap();
        
//         require(token_in == pool_id.0 || token_in == pool_id.1, "Invalid token_in");
        
//         let (reserve_in, reserve_out, token_out) = if token_in == pool_id.0 {
//             (pool_data.reserve_0, pool_data.reserve_1, pool_id.1)
//         } else {
//             (pool_data.reserve_1, pool_data.reserve_0, pool_id.0)
//         };
        
//         let amount_in = msg_amount();
//         require(amount_in > 0, "Amount in must be greater than 0");
//         require(msg_asset_id() == token_in, "Wrong asset sent");
        
//         let amount_out = get_amount_out(amount_in, reserve_in, reserve_out, LP_FEE_BPS);
        
//         require(amount_out >= min_amount_out, "Insufficient output amount");
//         require(amount_out < reserve_out, "Insufficient liquidity");
        
//         let new_reserve_in = reserve_in + amount_in;
//         let new_reserve_out = reserve_out - amount_out;
        
//         validate_constant_product(
//             pool_data.reserve_0,
//             pool_data.reserve_1,
//             if token_in == pool_id.0 { new_reserve_in } else { new_reserve_out },
//             if token_in == pool_id.0 { new_reserve_out } else { new_reserve_in },
//         );
        
//         if token_in == pool_id.0 {
//             pool_data.reserve_0 = new_reserve_in;
//             pool_data.reserve_1 = new_reserve_out;
//         } else {
//             pool_data.reserve_0 = new_reserve_out;
//             pool_data.reserve_1 = new_reserve_in;
//         }
//         storage.pools.insert(pool_id, pool_data);
        
//         let to = msg_sender().unwrap();
//         transfer(to, token_out, amount_out);
        
//         amount_out
//     }
// }

// // ========== TESTS ==========

// // #[test]
// // fn test_calculate_fee() {
// //     assert_eq(calculate_fee(10000, 30), 30); // 0.3% от 10000 = 30
// //     assert_eq(calculate_fee(1000, 30), 3); // 0.3% от 1000 = 3
// //     assert_eq(calculate_fee(100, 30), 1); // округление вверх
// //     assert_eq(calculate_fee(1, 30), 1); // минимум 1
// // }

// // #[test]
// // fn test_get_amount_out() {
// //     // Простой случай: 1000 токенов в, резервы 10000/10000, комиссия 0.3%
// //     let amount_out = get_amount_out(1000, 10000, 10000, 30);
// //     // Ожидаем примерно 970 токенов (с учетом комиссии)
// //     assert(amount_out > 900 && amount_out < 1000);
    
// //     // Проверка что больше резерва = ошибка
// //     // Это проверяется через should_revert тесты
// // }

// // #[test(should_revert)]
// // fn test_get_amount_out_zero_amount() {
// //     let _ = get_amount_out(0, 10000, 10000, 30);
// // }

// // #[test(should_revert)]
// // fn test_get_amount_out_zero_reserves() {
// //     let _ = get_amount_out(1000, 0, 10000, 30);
// // }

// // #[test]
// // fn test_validate_constant_product() {
// //     // Валидный случай: новые резервы больше или равны старым
// //     validate_constant_product(1000, 1000, 2000, 2000);
// //     validate_constant_product(1000, 1000, 1500, 1500);
// //     validate_constant_product(1000, 2000, 1000, 2000); // равны
// // }

// // #[test(should_revert)]
// // fn test_validate_constant_product_violation() {
// //     // Нарушение инварианта: k уменьшился
// //     validate_constant_product(1000, 1000, 500, 500);
// // }

// // #[test]
// // fn test_normalize_pool_id() {
// //     // Создаем два разных AssetId используя ZERO_B256 как основу
// //     let contract_a = ContractId::from(ZERO_B256);
// //     let contract_b = ContractId::from(0x2222222222222222222222222222222222222222222222222222222222222222);
// //     let sub_id = SubId::from(ZERO_B256);
    
// //     let token_a = AssetId::new(contract_a, sub_id);
// //     let token_b = AssetId::new(contract_b, sub_id);
    
// //     let pool_id_1 = normalize_pool_id(token_a, token_b);
// //     let pool_id_2 = normalize_pool_id(token_b, token_a);
    
// //     // Оба должны быть одинаковыми (нормализованными)
// //     assert_eq(pool_id_1.0, pool_id_2.0);
// //     assert_eq(pool_id_1.1, pool_id_2.1);
// // }

// // #[test]
// // fn test_set_owner() {
// //     let address = Address::from(0x1111111111111111111111111111111111111111111111111111111111111111);
// //     let owner = Identity::Address(address);
    
// //     // Первая установка владельца должна работать
// //     set_owner(owner);
    
// //     let current_owner = storage.owner.read();
// //     assert(current_owner.is_some());
// //     assert_eq(current_owner.unwrap(), owner);
// // }

// // #[test]
// // fn test_create_pool() {
// //     let contract_a = ContractId::from(ZERO_B256);
// //     let contract_b = ContractId::from(0x2222222222222222222222222222222222222222222222222222222222222222);
// //     let sub_id = SubId::from(ZERO_B256);
    
// //     let token_a = AssetId::new(contract_a, sub_id);
// //     let token_b = AssetId::new(contract_b, sub_id);
    
// //     let pool_id = create_pool(token_a, token_b);
    
// //     // Проверяем что пул создан
// //     let pool = get_pool_info(pool_id);
// //     assert(pool.is_some());
    
// //     let pool_data = pool.unwrap();
// //     assert_eq(pool_data.reserve_0, 0);
// //     assert_eq(pool_data.reserve_1, 0);
// //     assert_eq(pool_data.decimals_0, 9);
// //     assert_eq(pool_data.decimals_1, 9);
// // }

// // #[test(should_revert)]
// // fn test_create_pool_identical_tokens() {
// //     let contract_a = ContractId::from(ZERO_B256);
// //     let sub_id = SubId::from(ZERO_B256);
// //     let token_a = AssetId::new(contract_a, sub_id);
    
// //     let _ = create_pool(token_a, token_a);
// // }

// // #[test(should_revert)]
// // fn test_create_pool_already_exists() {
// //     let contract_a = ContractId::from(ZERO_B256);
// //     let contract_b = ContractId::from(0x2222222222222222222222222222222222222222222222222222222222222222);
// //     let sub_id = SubId::from(ZERO_B256);
    
// //     let token_a = AssetId::new(contract_a, sub_id);
// //     let token_b = AssetId::new(contract_b, sub_id);
    
// //     let _pool_id = create_pool(token_a, token_b);
    
// //     // Попытка создать тот же пул должна упасть
// //     let _ = create_pool(token_a, token_b);
// // }

// // #[test]
// // fn test_add_liquidity() {
// //     let address = Address::from(0x1111111111111111111111111111111111111111111111111111111111111111);
// //     let owner = Identity::Address(address);
// //     set_owner(owner);
    
// //     let contract_a = ContractId::from(ZERO_B256);
// //     let contract_b = ContractId::from(0x2222222222222222222222222222222222222222222222222222222222222222);
// //     let sub_id = SubId::from(ZERO_B256);
    
// //     let token_a = AssetId::new(contract_a, sub_id);
// //     let token_b = AssetId::new(contract_b, sub_id);
    
// //     let pool_id = create_pool(token_a, token_b);
    
// //     // Для теста нужно чтобы токены были на балансе контракта
// //     // В реальном сценарии они переводятся перед вызовом add_liquidity
// //     // Здесь мы просто проверяем логику функции
    
// //     // Проверяем что пул существует перед добавлением ликвидности
// //     let pool_before = get_pool_info(pool_id);
// //     assert(pool_before.is_some());
// // }

// // #[test(should_revert)]
// // fn test_add_liquidity_not_owner() {
// //     let address = Address::from(0x1111111111111111111111111111111111111111111111111111111111111111);
// //     let owner = Identity::Address(address);
// //     set_owner(owner);
    
// //     let contract_a = ContractId::from(ZERO_B256);
// //     let contract_b = ContractId::from(0x2222222222222222222222222222222222222222222222222222222222222222);
// //     let sub_id = SubId::from(ZERO_B256);
    
// //     let token_a = AssetId::new(contract_a, sub_id);
// //     let token_b = AssetId::new(contract_b, sub_id);
    
// //     let _pool_id = create_pool(token_a, token_b);
    
// //     // Попытка добавить ликвидность не владельцем должна упасть
// //     // Но в тестах мы не можем изменить msg_sender, поэтому этот тест проверяет только структуру
// // }

// // #[test]
// // fn test_get_pool_info() {
// //     let contract_a = ContractId::from(ZERO_B256);
// //     let contract_b = ContractId::from(0x2222222222222222222222222222222222222222222222222222222222222222);
// //     let sub_id = SubId::from(ZERO_B256);
    
// //     let token_a = AssetId::new(contract_a, sub_id);
// //     let token_b = AssetId::new(contract_b, sub_id);
    
// //     // Пул не существует
// //     let pool_none = get_pool_info((token_a, token_b));
// //     assert(pool_none.is_none());
    
// //     // Создаем пул
// //     let pool_id = create_pool(token_a, token_b);
    
// //     // Теперь пул должен существовать
// //     let pool_some = get_pool_info(pool_id);
// //     assert(pool_some.is_some());
// // }
