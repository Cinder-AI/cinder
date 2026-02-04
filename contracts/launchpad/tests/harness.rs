use fuels::{prelude::*, types::{ContractId, Identity}};
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;

const DEFAULT_WALLET_BALANCE: u64 = 1_000_000_000;

// Load contract ABI
abigen!(Contract(
    name = "LaunchpadContract",
    abi = "launchpad/out/debug/launchpad-abi.json"
));

async fn setup_wallets(count: u64) -> Vec<Wallet> {
    launch_custom_provider_and_get_wallets(
        WalletsConfig::new(
            Some(count),
            Some(1),
            Some(DEFAULT_WALLET_BALANCE),
        ),
        None,
        None,
    )
    .await
    .unwrap()
}

async fn deploy_launchpad(wallet: &Wallet) -> ContractId {
    Contract::load_from(
        "./out/debug/launchpad.bin",
        LoadConfiguration::default(),
    )
    .unwrap()
    .deploy(wallet, TxPolicies::default())
    .await
    .unwrap()
    .contract_id
}

fn instance(contract_id: ContractId, wallet: &Wallet) -> LaunchpadContract<Wallet> {
    LaunchpadContract::new(contract_id, wallet.clone())
}

async fn pledge_amount(
    contract_id: ContractId,
    wallet: &Wallet,
    token_id: AssetId,
    amount: u64,
) {
    let base_asset = AssetId::default();
    instance(contract_id, wallet)
        .methods()
        .pledge(token_id, amount)
        .call_params(CallParameters::new(amount, base_asset, 1_000_000))
        .unwrap()
        .call()
        .await
        .unwrap();
}

async fn claim_tokens(contract_id: ContractId, wallet: &Wallet, token_id: AssetId) {
    instance(contract_id, wallet)
        .methods()
        .claim(token_id)
        .with_variable_output_policy(VariableOutputPolicy::Exactly(1))
        .call()
        .await
        .unwrap();
}

async fn create_default_campaign(contract_instance: &LaunchpadContract<Wallet>) -> AssetId {
    let name = String::from("Test Token");
    let ticker = String::from("TEST");
    let description = String::from("Test Description");
    let image = String::from("Test Image");
    contract_instance.methods().create_campaign(name, ticker, description, image).call().await.unwrap().value
}

fn build_random_pledges(
    rng: &mut StdRng,
    users_count: usize,
    max_pledge: u64,
    target_total: u64,
) -> Vec<u64> {
    assert!(users_count > 0, "users_count must be > 0");
    let min_total = users_count as u64;
    let max_total = users_count as u64 * max_pledge;
    assert!(target_total >= min_total, "target_total too small");
    assert!(target_total <= max_total, "target_total too large");

    let mut pledges = vec![1u64; users_count];
    let mut remaining = target_total - min_total;

    for i in 0..users_count {
        let max_add = (max_pledge - 1).min(remaining);
        let add = if i == users_count - 1 {
            remaining
        } else {
            rng.gen_range(0..=max_add)
        };
        pledges[i] += add;
        remaining -= add;
    }

    pledges
}

#[tokio::test]
async fn test_contract_deployment() {
    // Start local provider
    let mut wallets = setup_wallets(2).await;
    
    let wallet = wallets.pop().unwrap();

    // Deploy contract and get ID
    let contract_id = deploy_launchpad(&wallet).await;  // <-- this is a FIELD, no parentheses!

    // Create contract instance
    let contract_instance = instance(contract_id, &wallet);
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
    let mut wallets = setup_wallets(2).await;
    let wallet = wallets.pop().unwrap();
    let contract_id = deploy_launchpad(&wallet).await;
    let contract_instance = instance(contract_id, &wallet);
    let token_id = create_default_campaign(&contract_instance).await;
    let result = contract_instance.methods().deny_campaign(token_id).call().await.unwrap();
    assert!(result.value);
    let campaign = contract_instance.methods().get_campaign(token_id).call().await.unwrap().value;
    dbg!(&campaign);
    assert_eq!(campaign.status, CampaignStatus::Failed);
}

#[tokio::test]
async fn test_refund_pledge_after_denial() {
    let mut wallets = setup_wallets(2).await;
    let creator_wallet = wallets.pop().unwrap();
    let user_wallet = wallets.pop().unwrap();
    let base_asset = AssetId::default();

    let contract_id = deploy_launchpad(&creator_wallet).await;
    let contract_creator = instance(contract_id, &creator_wallet);
    let contract_user = instance(contract_id, &user_wallet);

    let token_id = create_default_campaign(&contract_creator).await;

    let pledge_amount_value = 10_000u64;
    pledge_amount(contract_id, &user_wallet, token_id, pledge_amount_value).await;

    contract_creator.methods().deny_campaign(token_id).call().await.unwrap();

    let balance_before = user_wallet.get_asset_balance(&base_asset).await.unwrap();
    let refund_result = contract_user
        .methods()
        .refund_pledge(token_id)
        .with_variable_output_policy(VariableOutputPolicy::Exactly(1))
        .call()
        .await
        .unwrap();
    assert!(refund_result.value);
    let balance_after = user_wallet.get_asset_balance(&base_asset).await.unwrap();
    let expected = balance_before + pledge_amount_value as u128;
    assert!(balance_after <= expected);
    assert!(balance_after + 10 >= expected);

    let second_refund = contract_user
        .methods()
        .refund_pledge(token_id)
        .with_variable_output_policy(VariableOutputPolicy::Exactly(1))
        .call()
        .await;
    assert!(second_refund.is_err());
}

#[tokio::test]
async fn test_refund_pledge_before_denial_fails() {
    let mut wallets = setup_wallets(2).await;
    let creator_wallet = wallets.pop().unwrap();
    let user_wallet = wallets.pop().unwrap();
    let base_asset = AssetId::default();

    let contract_id = deploy_launchpad(&creator_wallet).await;
    let contract_creator = instance(contract_id, &creator_wallet);
    let contract_user = instance(contract_id, &user_wallet);

    let token_id = create_default_campaign(&contract_creator).await;
    let pledge_amount_value = 5_000u64;
    pledge_amount(contract_id, &user_wallet, token_id, pledge_amount_value).await;

    let refund_result = contract_user.methods().refund_pledge(token_id).call().await;
    assert!(refund_result.is_err());
}

#[tokio::test]
async fn test_pledge() {
    let mut wallets = setup_wallets(2).await;
    let base_asset = AssetId::default();
    let wallet_1 = wallets.pop().unwrap();
    let balance_1 = wallet_1.get_asset_balance(&base_asset).await.unwrap();
    dbg!(balance_1);
    dbg!(base_asset);
    let wallet_2 = wallets.pop().unwrap();
    let contract_id = deploy_launchpad(&wallet_1).await;
    let contract_instance = instance(contract_id, &wallet_1);
    let contract_instance_2 = instance(contract_id, &wallet_2);
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
    const WALLETS_COUNT: u64 = 100;
    // 1. Create wallets
    let mut wallets = setup_wallets(WALLETS_COUNT).await;
    
    let base_asset = AssetId::default();
    let creator_wallet = wallets.pop().unwrap();
    println!("Creator wallet: {:?}", creator_wallet.address());
    let contract_id = deploy_launchpad(&creator_wallet).await;
    println!("\n=== Contract deployed: {:?} ===", contract_id);
    let contract_creator = instance(contract_id, &creator_wallet);

    let mut user_wallets = Vec::new();

    let mut i = 0;
    while i < WALLETS_COUNT - 1 {
        let wallet = wallets.pop().unwrap();
        user_wallets.push(wallet);

        i += 1;
    }
    
    
    // 4. Creator creates a campaign
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
    println!("\n=== Token created: {:?} ===", token_id);
    
    // Check token info
    let token_info = contract_creator.methods().get_token_info(token_id).call().await.unwrap().value;
    println!("Token Info: {} ({}) - {}", token_info.name, token_info.ticker, token_info.description);
    
    // Check campaign status
    let campaign = contract_creator.methods().get_campaign(token_id).call().await.unwrap().value;
    println!("Campaign Status: {:?}", campaign.status);
    println!("Target: {}", campaign.target);
    println!("Total Pledged: {}", campaign.total_pledged);

    // 5. Users pledge a random D_total <= MIGRATION_TARGET
    const MAX_PLEDGE: u64 = 20_000;
    const MIGRATION_TARGET: u64 = 1_000_000;
    const INITIAL_SUPPLY: u64 = 1_000_000_000;
    const CURVE_PERCENT: u64 = 80;
    const TOLERANCE: u128 = 1_000;

    let users_count = user_wallets.len() as u64;
    let max_total = (users_count * MAX_PLEDGE).min(MIGRATION_TARGET);
    let mut rng = StdRng::seed_from_u64(42);
    let target_total = rng.gen_range(users_count..=max_total);
    let pledges = build_random_pledges(&mut rng, users_count as usize, MAX_PLEDGE, target_total);

    println!("\n=== Start pledge ===");
    let mut pledged_wallets: Vec<(Wallet, u64)> = Vec::new();
    let mut total_pledged = 0u64;

    for (wallet, amount) in user_wallets.iter().zip(pledges.into_iter()) {
        assert!(amount <= MAX_PLEDGE, "Pledge exceeds MAX_PLEDGE");

        let contract_instance = instance(contract_id, wallet);
        let result = contract_instance
            .methods()
            .pledge(token_id, amount)
            .call_params(CallParameters::new(amount, base_asset, 1_000_000))
            .unwrap()
            .call()
            .await
            .unwrap();

        assert!(result.value, "Pledge failed");
        total_pledged += amount;
        pledged_wallets.push((wallet.clone(), amount));

        let user_identity = Identity::Address(wallet.address().into());
        let pledged = contract_instance
            .methods()
            .get_pledge(token_id, user_identity)
            .call()
            .await
            .unwrap()
            .value;
        assert_eq!(pledged, amount);
    }

    assert_eq!(total_pledged, target_total);
    println!("\nTotal pledged: {}", total_pledged);

    // Check total pledged in campaign
    let campaign_after = contract_creator.methods().get_campaign(token_id).call().await.unwrap().value;
    println!("Campaign Total Pledged: {}", campaign_after.total_pledged);
    assert_eq!(campaign_after.total_pledged, total_pledged);

    // 6. Launch campaign
    println!("\n=== Launch campaign ===");
    let launch_result = contract_creator
        .methods()
        .launch_campaign(token_id)
        .call()
        .await
        .unwrap();
    assert!(launch_result.value, "Launch failed");

    // 7. Check campaign status and distribution amount
    let campaign_launched = contract_creator.methods().get_campaign(token_id).call().await.unwrap().value;
    println!("Campaign Status after launch: {:?}", campaign_launched.status);
    assert_eq!(campaign_launched.status, CampaignStatus::Launched);

    let curve_supply = INITIAL_SUPPLY * CURVE_PERCENT / 100;
    let users_share = curve_supply * total_pledged / MIGRATION_TARGET;
    assert_eq!(campaign_launched.curve.sold_supply, users_share);

    // 8. Users claim tokens
    println!("\n=== Claim for users ===");
    for (wallet, _) in pledged_wallets.iter() {
        claim_tokens(contract_id, wallet, token_id).await;
    }

    // 9. Check user token balances
    println!("\n=== Check token balances ===");
    for (wallet, amount) in pledged_wallets.iter() {
        let token_balance = wallet.get_asset_balance(&token_id).await.unwrap();
        let expected = (users_share as u128 * (*amount as u128)) / (total_pledged as u128);
        assert!(
            token_balance >= expected.saturating_sub(TOLERANCE) && token_balance <= expected + TOLERANCE,
            "Balance mismatch: got {}, expected {}",
            token_balance,
            expected
        );
    }

    println!("\n=== ✅ Test completed successfully! ===");
}

#[tokio::test]
async fn test_bonding_curve_buy_sell() {
    let mut wallets = setup_wallets(3).await;
    let creator_wallet = wallets.pop().unwrap();
    let user_1 = wallets.pop().unwrap();
    let user_2 = wallets.pop().unwrap();
    let base_asset = AssetId::default();

    let contract_id = deploy_launchpad(&creator_wallet).await;
    let contract_creator = instance(contract_id, &creator_wallet);
    let contract_user_1 = instance(contract_id, &user_1);
    let contract_user_2 = instance(contract_id, &user_2);

    let token_id = create_default_campaign(&contract_creator).await;

    let amount_1 = 20_000u64;
    pledge_amount(contract_id, &user_1, token_id, amount_1).await;

    let amount_2 = 10_000u64;
    pledge_amount(contract_id, &user_2, token_id, amount_2).await;

    contract_creator.methods().launch_campaign(token_id).call().await.unwrap();

    claim_tokens(contract_id, &user_1, token_id).await;
    claim_tokens(contract_id, &user_2, token_id).await;

    let campaign = contract_creator.methods().get_campaign(token_id).call().await.unwrap().value;
    let curve = campaign.curve;
    let remaining_supply = curve.max_supply - curve.sold_supply;
    let buy_amount = (remaining_supply / 100).max(1);

    let price_before = curve.base_price + curve.slope * curve.sold_supply;
    let expected_price_after_buy = curve.base_price + curve.slope * (curve.sold_supply + buy_amount);

    let price_scale: u128 = 1_000_000_000;
    let s = curve.sold_supply as u128;
    let delta = buy_amount as u128;
    let base = curve.base_price as u128;
    let slope = curve.slope as u128;
    let s_after = s + delta;
    let cost_scaled = base * delta + (slope * (s_after * s_after - s * s)) / 2;
    let cost = (cost_scaled / price_scale) as u64;

    let balance_before_buy = user_1.get_asset_balance(&token_id).await.unwrap();
    let buy_result = contract_user_1
        .methods()
        .buy(token_id, buy_amount, cost)
        .with_variable_output_policy(VariableOutputPolicy::Exactly(1))
        .call_params(CallParameters::new(cost, base_asset, 1_000_000))
        .unwrap()
        .call()
        .await
        .unwrap();
    assert_eq!(buy_result.value, cost);

    let balance_after_buy = user_1.get_asset_balance(&token_id).await.unwrap();
    assert_eq!(balance_after_buy, balance_before_buy + buy_amount as u128);

    let campaign_after_buy = contract_creator.methods().get_campaign(token_id).call().await.unwrap().value;
    assert_eq!(campaign_after_buy.curve.sold_supply, curve.sold_supply + buy_amount);
    let price_after_buy = campaign_after_buy.curve.base_price
        + campaign_after_buy.curve.slope * campaign_after_buy.curve.sold_supply;
    assert_eq!(price_after_buy, expected_price_after_buy);

    let sell_amount = (buy_amount / 2).max(1);
    let expected_price_after_sell = curve.base_price
        + curve.slope * (curve.sold_supply + buy_amount - sell_amount);

    let s_sell = campaign_after_buy.curve.sold_supply as u128;
    let delta_sell = sell_amount as u128;
    let s_before = s_sell - delta_sell;
    let refund_scaled = base * delta_sell + (slope * (s_sell * s_sell - s_before * s_before)) / 2;
    let refund = (refund_scaled / price_scale) as u64;

    let balance_before_sell = user_1.get_asset_balance(&token_id).await.unwrap();
    let sell_result = contract_user_1
        .methods()
        .sell(token_id, sell_amount, refund)
        .with_variable_output_policy(VariableOutputPolicy::Exactly(1))
        .call_params(CallParameters::new(sell_amount, token_id, 1_000_000))
        .unwrap()
        .call()
        .await
        .unwrap();
    assert_eq!(sell_result.value, refund);

    let balance_after_sell = user_1.get_asset_balance(&token_id).await.unwrap();
    assert_eq!(balance_after_sell, balance_before_sell - sell_amount as u128);

    let campaign_after_sell = contract_creator.methods().get_campaign(token_id).call().await.unwrap().value;
    assert_eq!(
        campaign_after_sell.curve.sold_supply,
        campaign_after_buy.curve.sold_supply - sell_amount
    );
    let price_after_sell = campaign_after_sell.curve.base_price
        + campaign_after_sell.curve.slope * campaign_after_sell.curve.sold_supply;
    assert_eq!(price_after_sell, expected_price_after_sell);
}

#[tokio::test]
async fn test_get_assets() {
    let mut wallets = setup_wallets(1).await;
    let wallet = wallets.pop().unwrap();
    let contract_id = deploy_launchpad(&wallet).await;
    let contract_instance = instance(contract_id, &wallet);
    let token_id = create_default_campaign(&contract_instance).await;
    let token_id_2 = create_default_campaign(&contract_instance).await;
    let token_id_3 = create_default_campaign(&contract_instance).await;
    let token_id_4 = create_default_campaign(&contract_instance).await;
    let token_id_5 = create_default_campaign(&contract_instance).await;
    let token_id_6 = create_default_campaign(&contract_instance).await;
    let assets = contract_instance.methods().get_assets().call().await.unwrap().value;
    dbg!(&assets);
}