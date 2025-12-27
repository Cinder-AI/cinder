use fuels::{prelude::*, types::{ContractId, Identity, AssetId, Bits256}};

// Загрузка ABI контракта
abigen!(Contract(
    name = "AMMContract",
    abi = "amm/out/debug/amm-abi.json"
));


#[tokio::test]
async fn test_contract_deposit() {
    // 1. Создаем конфигурацию с двумя ассетами
    let asset_configs = vec![
        AssetConfig {
            id: AssetId::default(),
            num_coins: 1,
            coin_amount: 1_000_000_000,
        },
        AssetConfig {
            id: AssetId::new([1u8; 32]),
            num_coins: 1,
            coin_amount: 1_000_000_000,
        },
    ];

    let wallet_config = WalletsConfig::new_multiple_assets(1, asset_configs);
    
    let mut wallets = launch_custom_provider_and_get_wallets(
        wallet_config,
        None,
        None,
    )
    .await
    .unwrap();
    
    let wallet = wallets.pop().unwrap();
    let provider = wallet.provider();


    // 2. Деплой контракта
    let contract_id = Contract::load_from(
        "./out/debug/amm.bin",
        LoadConfiguration::default(),
    )
    .unwrap()
    .deploy(&wallet, TxPolicies::default())
    .await
    .unwrap()
    .contract_id;

    // 3. Определяем два разных ассета
    let token_0 = AssetId::default();
    let token_1 = AssetId::new([1u8; 32]);
    
    // 4. Проверяем начальные балансы кошелька
    let contract_balance_0_before = provider
        .get_contract_asset_balance(&contract_id, &token_0)
        .await
        .unwrap();

    let contract_balance_1_before = provider
        .get_contract_asset_balance(&contract_id, &token_1)
        .await
        .unwrap();

    println!("Contract balance before:");
    println!("  token_0: {}", contract_balance_0_before);
    println!("  token_1: {}", contract_balance_1_before);

    // 5. Суммы для перевода
    let amount_0: u64 = 100_000_000; // 0.1 token
    let amount_1: u64 = 200_000_000; // 0.2 token

    let wallet_balance_0_before = wallet.get_asset_balance(&token_0).await.unwrap();
    let wallet_balance_1_before = wallet.get_asset_balance(&token_1).await.unwrap();
    println!("Wallet balance before:");
    println!("  token_0: {}", wallet_balance_0_before);
    println!("  token_1: {}", wallet_balance_1_before);

    // 6. Переводим token_0 на контракт используя force_transfer_to_contract
    wallet
        .force_transfer_to_contract(contract_id.into(), amount_0, token_0, TxPolicies::default())
        .await
        .unwrap();
    
    // 7. Переводим token_1 на контракт
    wallet
        .force_transfer_to_contract(contract_id.into(), amount_1, token_1, TxPolicies::default())
        .await
        .unwrap();

    // 8. Проверяем балансы контракта
    let contract_balance_0 = provider
        .get_contract_asset_balance(&contract_id, &token_0)
        .await
        .unwrap();
    
    let contract_balance_1 = provider
        .get_contract_asset_balance(&contract_id, &token_1)
        .await
        .unwrap();

    println!("\nContract balance after transfers:");
    println!("  token_0: {}", contract_balance_0);
    println!("  token_1: {}", contract_balance_1);

    // 9. Проверяем балансы кошелька после переводов
    let wallet_balance_0_after = wallet.get_asset_balance(&token_0).await.unwrap();
    let wallet_balance_1_after = wallet.get_asset_balance(&token_1).await.unwrap();
    
    println!("\nWallet balance after:");
    println!("  token_0: {}", wallet_balance_0_after);
    println!("  token_1: {}", wallet_balance_1_after);

    // 10. Проверяем что контракт получил правильные суммы
    assert_eq!(contract_balance_0, amount_0, "Contract should have exactly amount_0 of token_0");
    assert_eq!(contract_balance_1, amount_1, "Contract should have exactly amount_1 of token_1");
    
    // 11. Проверяем что балансы кошелька уменьшились (учитываем комиссию газа для token_0)
    assert!(wallet_balance_0_after < wallet_balance_0_before - amount_0 as u128, "Wallet balance_0 should decrease");
    assert_eq!(wallet_balance_1_after, wallet_balance_1_before - amount_1 as u128, "Wallet balance_1 should decrease exactly by amount_1");
}