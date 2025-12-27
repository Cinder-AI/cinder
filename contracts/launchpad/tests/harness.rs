use fuels::{prelude::*, types::{ContractId, Identity}};

// Загрузка ABI контракта
abigen!(Contract(
    name = "LaunchpadContract",
    abi = "launchpad/out/debug/launchpad-abi.json"
));

async fn create_default_campaign(contract_instance: &LaunchpadContract<Wallet>) -> AssetId {
    let name = String::from("Test Token");
    let ticker = String::from("TEST");
    let description = String::from("Test Description");
    let image = String::from("Test Image");
    contract_instance.methods().create_campaign(name, ticker, description, image).call().await.unwrap().value
}

#[tokio::test]
async fn test_contract_deployment() {
    // Запуск локального провайдера
    let mut wallets = launch_custom_provider_and_get_wallets(
        WalletsConfig::new(
            Some(2),             // количество кошельков
            Some(1),             // количество монет
            Some(1_000_000_000), // количество токенов
        ),
        None,
        None,
    )
    .await
    .unwrap();
    
    let wallet = wallets.pop().unwrap();

    // Деплой контракта и получение ID
    let contract_id = Contract::load_from(
        "./out/debug/launchpad.bin",
        LoadConfiguration::default(),
    )
    .unwrap()
    .deploy(&wallet, TxPolicies::default())
    .await
    .unwrap()
    .contract_id;  // <-- это ПОЛЕ, без скобок!

    // Создание инстанса контракта
    let contract_instance = LaunchpadContract::new(contract_id, wallet.clone());
    let counter = contract_instance.methods().get_campaign_counter().call().await.unwrap().value;
    dbg!(counter);
    let name = String::from("Test Token");
    let ticker = String::from("TEST");
    let description = String::from("Test Description");
    let image = String::from("Test Image");
    let result = contract_instance.methods().create_campaign(name, ticker, description, image).call().await.unwrap();
    let token_id_1 = result.value;
    let counter_2 = contract_instance.methods().get_campaign_counter().call().await.unwrap().value;
    dbg!(counter_2);
    assert_ne!(counter, counter_2);
    let name_2 = String::from("Test Token 2");
    let ticker_2 = String::from("TEST2");
    let description_2 = String::from("Test Description 2");
    let image_2 = String::from("Test Image 2");
    let result_2 = contract_instance.methods().create_campaign(name_2, ticker_2, description_2, image_2).call().await.unwrap();
    let token_id_2 = result_2.value;
    assert_ne!(token_id_1, token_id_2);
    dbg!(token_id_1);
    dbg!(token_id_2);
    let campaign_1 = contract_instance.methods().get_campaign(token_id_1).call().await.unwrap().value;
    dbg!(&campaign_1);
    let campaign_2 = contract_instance.methods().get_campaign(token_id_2).call().await.unwrap().value;
    dbg!(&campaign_2);
    assert_ne!(campaign_1.token_id, campaign_2.token_id);

    let token_info_1 = contract_instance.methods().get_token_info(token_id_1).call().await.unwrap().value;
    dbg!(&token_info_1);

    let token_info_2 = contract_instance.methods().get_token_info(token_id_2).call().await.unwrap().value;
    dbg!(&token_info_2);
    assert_ne!(token_info_1.name, token_info_2.name);
    assert_ne!(token_info_1.ticker, token_info_2.ticker);
    assert_ne!(token_info_1.description, token_info_2.description);
    assert_ne!(token_info_1.image, token_info_2.image);
}

#[tokio::test]
async fn test_deny_campaign() {
    let mut wallets = launch_custom_provider_and_get_wallets(
        WalletsConfig::new(
            Some(2),
            Some(1),
            Some(1_000_000_000),
        ),
        None,
        None,
    )
    .await.unwrap();
    let wallet = wallets.pop().unwrap();
    let contract_id = Contract::load_from(
        "./out/debug/launchpad.bin",
        LoadConfiguration::default(),
    )
    .unwrap()
    .deploy(&wallet, TxPolicies::default())
    .await
    .unwrap()
    .contract_id;
    let contract_instance = LaunchpadContract::new(contract_id, wallet.clone());
    let token_id = create_default_campaign(&contract_instance).await;
    let result = contract_instance.methods().deny_campaign(token_id).call().await.unwrap();
    assert!(result.value);
    let campaign = contract_instance.methods().get_campaign(token_id).call().await.unwrap().value;
    dbg!(&campaign);
    assert_eq!(campaign.status, CampaignStatus::Failed);
}

#[tokio::test]
async fn test_pledge() {
    let mut wallets = launch_custom_provider_and_get_wallets(
        WalletsConfig::new(
            Some(2),
            Some(1),
            Some(1_000_000_000),
        ),
        None,
        None,
    )
    .await.unwrap();
    let base_asset = AssetId::default();
    let wallet_1 = wallets.pop().unwrap();
    let balance_1 = wallet_1.get_asset_balance(&base_asset).await.unwrap();
    dbg!(balance_1);
    dbg!(base_asset);
    let wallet_2 = wallets.pop().unwrap();
    let contract_id = Contract::load_from(
        "./out/debug/launchpad.bin",
        LoadConfiguration::default(),
    )
    .unwrap()
    .deploy(&wallet_1, TxPolicies::default())
    .await
    .unwrap()
    .contract_id;
    let contract_instance = LaunchpadContract::new(contract_id, wallet_1.clone());
    let contract_instance_2 = LaunchpadContract::new(contract_id, wallet_2.clone());
    let token_id = create_default_campaign(&contract_instance).await;
    let token_id_2 = create_default_campaign(&contract_instance_2).await;

    let user_1 = Identity::Address(wallet_1.address().into());
    let user_2 = Identity::Address(wallet_2.address().into());
    let base_asset = AssetId::default();
    
    let pledge_1 = contract_instance_2.methods().get_pledge(token_id, user_2.clone()).call().await.unwrap().value;
    dbg!(pledge_1);
    
    let balance_before = wallet_2.get_asset_balance(&base_asset).await.unwrap();
    dbg!(balance_before);
    
    let result = contract_instance_2
        .methods()
        .pledge(token_id, 10000)
        .call_params(CallParameters::new(10000, base_asset, 1_000_000))
        .unwrap()
        .call()
        .await
        .unwrap();
    
    let balance_after = wallet_2.get_asset_balance(&base_asset).await.unwrap();
    dbg!(balance_after);
    dbg!(result.value);
    
    let pledge_after = contract_instance_2.methods().get_pledge(token_id, user_2).call().await.unwrap().value;
    dbg!(pledge_after);
    
    let user_1_pledge = contract_instance.methods().get_pledge(token_id, user_1).call().await.unwrap().value;
    dbg!(user_1_pledge);
}

#[tokio::test]
async fn test_full_campaign_flow() {
    // 1. Создаем 6 кошельков
    let mut wallets = launch_custom_provider_and_get_wallets(
        WalletsConfig::new(
            Some(6),             // 6 кошельков
            Some(1),             // 1 тип монет
            Some(1_000_000_000), // по 1 млрд базовых токенов
        ),
        None,
        None,
    )
    .await
    .unwrap();
    
    let base_asset = AssetId::default();
    
    // Распределяем кошельки
    let creator_wallet = wallets.pop().unwrap();
    let pledger_1 = wallets.pop().unwrap();
    let pledger_2 = wallets.pop().unwrap();
    let pledger_3 = wallets.pop().unwrap();
    let pledger_4 = wallets.pop().unwrap();
    let pledger_5 = wallets.pop().unwrap();
    
    println!("=== Балансы кошельков до теста ===");
    println!("Creator: {}", creator_wallet.get_asset_balance(&base_asset).await.unwrap());
    println!("Pledger 1: {}", pledger_1.get_asset_balance(&base_asset).await.unwrap());
    
    // 2. Деплоим контракт с измененным MIGRATION_TARGET для теста
    let contract_id = Contract::load_from(
        "./out/debug/launchpad.bin",
        LoadConfiguration::default()
    )
    .unwrap()
    .deploy(&creator_wallet, TxPolicies::default())
    .await
    .unwrap()
    .contract_id;
    
    println!("\n=== Контракт задеплоен: {:?} ===", contract_id);
    
    // 3. Создаем инстансы контракта для каждого кошелька
    let contract_creator = LaunchpadContract::new(contract_id, creator_wallet.clone());
    let contract_p1 = LaunchpadContract::new(contract_id, pledger_1.clone());
    let contract_p2 = LaunchpadContract::new(contract_id, pledger_2.clone());
    let contract_p3 = LaunchpadContract::new(contract_id, pledger_3.clone());
    let contract_p4 = LaunchpadContract::new(contract_id, pledger_4.clone());
    let contract_p5 = LaunchpadContract::new(contract_id, pledger_5.clone());
    
    // 4. Creator создает кампанию
    let token_name = String::from("Cinder Token");
    let token_ticker = String::from("CIN");
    let token_description = String::from("The hottest memecoin");
    let token_image = String::from("https://cinder.com/logo.png");
    
    let result = contract_creator
        .methods()
        .create_campaign(token_name, token_ticker, token_description, token_image)
        .call()
        .await
        .unwrap();
    
    let token_id = result.value;
    println!("\n=== Токен создан: {:?} ===", token_id);
    
    // Проверяем информацию о токене
    let token_info = contract_creator.methods().get_token_info(token_id).call().await.unwrap().value;
    println!("Token Info: {} ({}) - {}", token_info.name, token_info.ticker, token_info.description);
    
    // Проверяем статус кампании
    let campaign = contract_creator.methods().get_campaign(token_id).call().await.unwrap().value;
    println!("Campaign Status: {:?}", campaign.status);
    println!("Target: {}", campaign.target);
    println!("Total Pledged: {}", campaign.total_pledged);
    
    // 5. Пользователи делают pledge КОРРЕКТНЫХ размеров (≤ 20_000)
    let pledge_amounts = vec![
        (contract_p1, 15_000u64, "Pledger 1"),
        (contract_p2, 12_000u64, "Pledger 2"),
        (contract_p3, 8_000u64, "Pledger 3"),
        (contract_p4, 10_000u64, "Pledger 4"),
        (contract_p5, 5_000u64, "Pledger 5"),
    ];
    
    println!("\n=== Начинаем pledge ===");
    
    let mut total_pledged = 0u64;
    for (contract_instance, amount, name) in pledge_amounts.iter() {
        println!("{} pledges {} tokens", name, amount);
        
        let result = contract_instance
            .methods()
            .pledge(token_id, *amount)
            .call_params(CallParameters::new(*amount, base_asset, 1_000_000))
            .unwrap()
            .call()
            .await
            .unwrap();
        
        assert!(result.value, "{} pledge failed", name);
        total_pledged += amount;
        
        // Проверяем pledge пользователя
        let user_identity = Identity::Address(contract_instance.account().address().into());
        let pledged = contract_instance.methods().get_pledge(token_id, user_identity).call().await.unwrap().value;
        println!("{} pledged amount: {}", name, pledged);
        assert_eq!(pledged, *amount);
    }
    
    println!("\nTotal pledged: {}", total_pledged);
    
    // Проверяем общий pledge в кампании
    let campaign_after = contract_creator.methods().get_campaign(token_id).call().await.unwrap().value;
    println!("Campaign Total Pledged: {}", campaign_after.total_pledged);
    assert_eq!(campaign_after.total_pledged, total_pledged);
    
    // 6. Информируем о достижении target (но не блокируем тест)
    println!("\n=== Статус достижения цели ===");
    println!("Target: {}", campaign_after.target);
    println!("Pledged: {}", campaign_after.total_pledged);
    
    if campaign_after.total_pledged >= campaign_after.target {
        println!("✅ Target достигнут!");
    } else {
        println!("⚠️  Target не достигнут (но запускаем для теста)");
    }
    
    println!("\n=== Запускаем кампанию ===");
    
    // 7. Creator запускает кампанию
    let launch_result = contract_creator
        .methods()
        .launch_campaign(token_id)
        .with_variable_output_policy(VariableOutputPolicy::EstimateMinimum)

        .call()
        .await
        .unwrap();
    
    assert!(launch_result.value, "Launch failed");
    println!("Campaign launched successfully!");
    let contract_balance = contract_creator
        .account()
        .provider()
        .get_contract_asset_balance(&contract_id, &base_asset)
        .await
        .unwrap();

    println!("Contract balance (base asset): {}", contract_balance);

    let contract_address = contract_creator.account().address();
    let balances = contract_creator
        .account()
        .provider()
        .get_balances(&contract_address)
        .await
        .unwrap();

    println!("Balances: {:?}", balances);
    
    // 8. Проверяем статус кампании
    let campaign_launched = contract_creator.methods().get_campaign(token_id).call().await.unwrap().value;
    println!("Campaign Status after launch: {:?}", campaign_launched.status);
    assert_eq!(campaign_launched.status, CampaignStatus::Launched);
    println!("Total Supply: {}", campaign_launched.total_supply);
    
    // 9. Проверяем балансы токенов у участников
    println!("\n=== Проверяем балансы токенов ===");
    
    let wallets_check = vec![
        (pledger_1, 15_000u64, "Pledger 1"),
        (pledger_2, 12_000u64, "Pledger 2"),
        (pledger_3, 8_000u64, "Pledger 3"),
        (pledger_4, 10_000u64, "Pledger 4"),
        (pledger_5, 5_000u64, "Pledger 5"),
    ];
    
    let initial_supply = 1_000_000_000u64;
    let distribution_supply = initial_supply * 80 / 100; // 80% для участников
    
    for (wallet, pledge_amount, name) in wallets_check.iter() {
        let token_balance = wallet.get_asset_balance(&token_id).await.unwrap();
        let expected = ((pledge_amount * distribution_supply) / total_pledged) as u128;
        
        println!("{}: balance = {}, expected = {}", name, token_balance, expected);
        
        // Проверяем, что баланс примерно равен ожидаемому (с учетом округления)
        assert!(
            token_balance >= expected.saturating_sub(1000) && token_balance <= expected + 1000,
            "{} balance mismatch: got {}, expected {}",
            name,
            token_balance,
            expected
        );
    }
    
    println!("\n=== ✅ Тест завершен успешно! ===");
    println!("Распределение:");
    println!("  Pledger 1 (15k): {}%", (15_000 * 100) / total_pledged);
    println!("  Pledger 2 (12k): {}%", (12_000 * 100) / total_pledged);
    println!("  Pledger 3 (8k): {}%", (8_000 * 100) / total_pledged);
    println!("  Pledger 4 (10k): {}%", (10_000 * 100) / total_pledged);
    println!("  Pledger 5 (5k): {}%", (5_000 * 100) / total_pledged);
}

#[tokio::test]
async fn test_get_assets() {
    let mut wallets = launch_custom_provider_and_get_wallets(
        WalletsConfig::new(
            Some(1),
            Some(1),
            Some(1_000_000_000),
        ),
        None,
        None,
    )
    .await
    .unwrap();
    let wallet = wallets.pop().unwrap();
    let contract_id = Contract::load_from(
        "./out/debug/launchpad.bin",
        LoadConfiguration::default(),
    )
    .unwrap()
    .deploy(&wallet, TxPolicies::default())
    .await
    .unwrap()
    .contract_id;
    let contract_instance = LaunchpadContract::new(contract_id, wallet.clone());
    let token_id = create_default_campaign(&contract_instance).await;
    let token_id_2 = create_default_campaign(&contract_instance).await;
    let token_id_3 = create_default_campaign(&contract_instance).await;
    let token_id_4 = create_default_campaign(&contract_instance).await;
    let token_id_5 = create_default_campaign(&contract_instance).await;
    let token_id_6 = create_default_campaign(&contract_instance).await;
    let assets = contract_instance.methods().get_assets().call().await.unwrap().value;
    dbg!(&assets);
}