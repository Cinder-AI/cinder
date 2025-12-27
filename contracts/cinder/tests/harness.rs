use fuels::{prelude::*, types::{ContractId, Identity, AssetId}, tx::ContractIdExt};


abigen!(Contract(
    name = "CinderContract",
    abi = "cinder/out/debug/cinder-abi.json"
));

#[tokio::test]
async fn mint_100_tokens() {
    let mut wallets = launch_custom_provider_and_get_wallets(
        WalletsConfig::new(
            Some(1),
            Some(1),
            Some(1_000_000_000),
        ),
        None,
        None,
    )
    .await.unwrap();
    let wallet = wallets.pop().unwrap();
    let contract_id = Contract::load_from(
        "./out/debug/cinder.bin",
        LoadConfiguration::default(),
    )
    .unwrap()
    .deploy(&wallet, TxPolicies::default())
    .await
    .unwrap()
    .contract_id;

    let contract = CinderContract::new(contract_id, wallet.clone());
    // Получаем default_sub_id из контракта
    let default_sub_id = contract.methods().default_sub_id().call().await.unwrap().value;
    // ИСПРАВЛЕНИЕ: используем default_asset вместо base_asset
    let contract_asset = contract.methods().default_asset().call().await.unwrap().value;
    let asset_info = contract.methods().asset_info(contract_asset).call().await.unwrap().value;
    dbg!(asset_info);
    let recipient = Identity::Address(wallet.address().into());
    let balance = wallet.get_asset_balance(&contract_asset).await.unwrap();
    dbg!(balance);
    // Минтим токены
    let result = contract.methods()
        .mint(recipient, Some(default_sub_id), 100)
        .with_variable_output_policy(VariableOutputPolicy::Exactly(1))
        .call()
        .await
        .unwrap();
    
    // Проверяем total_supply - используем contract_asset
    let total_supply = contract.methods()
        .total_supply(contract_asset)
        .call()
        .await
        .unwrap()
        .value;
    dbg!(total_supply);
    assert_eq!(total_supply, Some(100u64));
    
    // Проверяем баланс кошелька
    dbg!(contract_asset);
    let balance = wallet.get_asset_balance(&contract_asset).await.unwrap();
    assert_eq!(balance, 100);
    dbg!(balance);
}