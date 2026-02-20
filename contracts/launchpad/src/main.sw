contract;

pub mod events;

use std::{
    string::String,
    storage::storage_string::*,
    storage::storage_vec::*,
    asset::{mint, burn, transfer, mint_to},
    call_frames::msg_asset_id,
    constants::DEFAULT_SUB_ID,
    context::{msg_amount},
    hash::sha256,
    logging::log,
    auth::msg_sender,
    identity::Identity,
    contract_id::ContractId,
    assert::assert,
    block::timestamp,
};

use events::{
    CampaignCreatedEvent,
    CampaignDeniedEvent,
    CampaignDeletedEvent,
    CampaignLaunchedEvent,
    CampaignMigratedEvent,
    PledgedEvent,
    ClaimEvent,
    BuyEvent,
    SellEvent,
    MintEvent,
    BurnEvent,
    BoostEvent,
};
use types::launchpad::Launchpad;
use types::cinder::CinderToken;
use types::campaign::{CampaignStatus, Campaign};
use types::bonding::BondingCurve;
use types::structs::{TokenInfo, Pledge};
use types::boost::{Boost, BoostStatus};
use utils::*;

use src20::{TotalSupplyEvent, SRC20};
use src3::SRC3;
use src7::{SRC7, Metadata};
use src5::{SRC5, State};

configurable {
    DEFAULT_DECIMALS: u8 = 9,
    MIGRATION_TARGET: u64 = 1_000_000_000_000_000,
    INITIAL_SUPPLY: u64 = 1_000_000_000_000_000_000,
    PLEDGE_ASSET_ID: b256 = 0x60cf8cfde5ea5885829caafdcc3583114c90f74816254c75af8cedca050b0d0d,
    CINDER_CONTRACT_ID: b256 = 0x3f7fbd9de81246302e438bf32031e3938d39d6858acfba4666e6ca565672d940,
    CURVE_SUPPLY_PERCENT: u64 = 80,
    INSTANT_LAUNCH_THRESHOLD_PERCENT: u64 = 80,
}

storage {
    total_supply: StorageMap<AssetId, u64> = StorageMap {},
    name: StorageMap<AssetId, StorageString> = StorageMap {},
    ticker: StorageMap<AssetId, StorageString> = StorageMap {},
    decimals: StorageMap<AssetId, u8> = StorageMap {},
    description: StorageMap<AssetId, StorageString> = StorageMap {},
    image: StorageMap<AssetId, StorageString> = StorageMap {},
    pledges: StorageMap<AssetId, StorageVec<Pledge>> = StorageMap {},
    assets: StorageVec<AssetId> = StorageVec {},
    campaigns: StorageMap<AssetId, Campaign> = StorageMap {},
    campaign_counter: u64 = 0,
    owner: State = State::Uninitialized,
}


// ------ HELPER FUNCTIONS ------

fn pledge_asset_id() -> AssetId {
    if PLEDGE_ASSET_ID == b256::zero() {
        AssetId::base()
    } else {
        AssetId::from(PLEDGE_ASSET_ID)
    }
}

fn cinder_asset_id() -> AssetId {
    AssetId::new(ContractId::from(CINDER_CONTRACT_ID), DEFAULT_SUB_ID)
}

#[storage(read)]
fn get_creator_campaigns(creator: Identity) -> Vec<Campaign> {
    let mut campaigns: Vec<Campaign> = Vec::new();
    let mut i = 0;
    while i < storage.assets.len() {
        let asset_id = storage.assets.get(i).unwrap().read();
        let campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        if campaign.creator == creator {
            campaigns.push(campaign);
        }
        i += 1;
    }
    campaigns
}

fn get_active_campaigns(creator_campaigns: Vec<Campaign>) -> Vec<Campaign> {
    let mut campaigns: Vec<Campaign> = Vec::new();
    let mut i = 0;
    while i < creator_campaigns.len() {
        let campaign = creator_campaigns.get(i).unwrap();
        if campaign.status == CampaignStatus::Active {
            campaigns.push(campaign);
        }
        i += 1;
    }
    campaigns
}

#[storage(read)]
fn can_create_campaign(creator: Identity) -> bool {
    let creator_campaigns = get_creator_campaigns(creator);
    let active_campaigns = get_active_campaigns(creator_campaigns);
    active_campaigns.len() < 1
}


fn is_instant_launch_ready(total_pledged: u64) -> bool {
    total_pledged >= (MIGRATION_TARGET / 100) * INSTANT_LAUNCH_THRESHOLD_PERCENT
}

#[storage(read, write)]
fn do_launch(asset_id: AssetId, campaign: Campaign, sender: Identity) -> bool {
    let mut campaign = campaign;
    require(campaign.status == CampaignStatus::Active, "Not active");
    require(campaign.total_pledged > 0, "No pledges");

    let curve_supply = (INITIAL_SUPPLY / 100) * CURVE_SUPPLY_PERCENT;
    let amm_supply = INITIAL_SUPPLY - curve_supply;

    let users_share = (curve_supply / MIGRATION_TARGET) * campaign.total_pledged;
    let remaining_supply = curve_supply - users_share;
    require(users_share <= curve_supply, "User share exceeds curve supply");

    campaign.curve.initialize(campaign.total_pledged, users_share);
    mint(campaign.sub_id, INITIAL_SUPPLY);
    campaign.amm_reserved = amm_supply;
    campaign.curve_reserve = campaign.total_pledged;
    campaign.status = CampaignStatus::Launched;
    storage.campaigns.insert(asset_id, campaign);
    log(CampaignLaunchedEvent {
        asset_id,
        sender,
        users_share,
        remaining_supply,
        amm_supply,
        base_price: campaign.curve.base_price,
        slope: campaign.curve.slope,
        max_supply: campaign.curve.max_supply,
        curve_reserve: campaign.curve_reserve,
    });

    true
}

#[storage(read, write)]
fn _boost_campaign(asset_id: AssetId, burn_amount: u64) -> Boost {
    let sender = msg_sender().unwrap();
    let now_ts = timestamp();
    let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();

    require(campaign.status == CampaignStatus::Active, "Campaign is not active");
    require(campaign.creator == sender, "Sender is not the campaign creator");

    let cinder = abi(CinderToken, CINDER_CONTRACT_ID);
    let cinder_asset_id = cinder_asset_id();
    let paid_amount = msg_amount();

    require(paid_amount == burn_amount, "Insufficient amount provided");
    require(msg_asset_id() == cinder_asset_id, "Sent asset is not the cinder asset");

    if burn_amount > 0 {
        // if cinder burn reverts, whole tx will be reverted
        // if there is leftover credit, we don't add it to the burn amount
        // to make
        let success = cinder.burn_cinder {
            coins: burn_amount,
            asset_id: cinder_asset_id.into(),
            gas: 1000000000,
        }(sender, burn_amount);
        require(success, "Cinder burn failed");
    }

    let boost = Boost::new(burn_amount, now_ts);
    campaign.boost = Some(boost);
    storage.campaigns.insert(asset_id, campaign);

    log(BoostEvent {
        asset_id,
        creator: sender,
        burn_amount,
        burned_at: now_ts,
        boost_power_x1e6: boost.boost_power_x1e6,
        duration_secs: boost.duration_secs,
        ends_at: boost.ends_at,
    });

    boost
}

#[storage(read)]
fn read_token_info(asset_id: AssetId) -> TokenInfo {
    let name = storage.name.get(asset_id).read_slice().unwrap();
    let ticker = storage.ticker.get(asset_id).read_slice().unwrap();
    let description = storage.description.get(asset_id).read_slice().unwrap();
    let image = storage.image.get(asset_id).read_slice().unwrap();
    let decimals = storage.decimals.get(asset_id).try_read().unwrap_or(DEFAULT_DECIMALS);
    
    TokenInfo {
        asset_id: asset_id,
        name: name,
        ticker: ticker,
        description: description,
        image: image,
        decimals: decimals,
    }
}

// #[storage(read)]
// fn get_boosts()

// ------ SRC IMPLEMENTATIONS ------

impl SRC5 for  Contract {
    #[storage(read)]
    fn owner() -> State {
        storage.owner.read()
    }
}

impl SRC20 for Contract {
    #[storage(read)]
    fn total_assets() -> u64 {
        storage.assets.len()
    }

    #[storage(read)]
    fn total_supply(asset: AssetId) -> Option<u64> {
        storage.total_supply.get(asset).try_read()
    }

    #[storage(read)]
    fn name(asset: AssetId) -> Option<String> {
        storage.name.get(asset).read_slice()
    }

    #[storage(read)]
    fn symbol(asset: AssetId) -> Option<String> {
        storage.ticker.get(asset).read_slice()
    }

    #[storage(read)]
    fn decimals(asset: AssetId) -> Option<u8> {
        storage.decimals.get(asset).try_read()
    }
}

impl SRC7 for Contract {
    #[storage(read)]
    fn metadata(asset: AssetId, key: String) -> Option<Metadata> {
        if storage.total_supply.get(asset).try_read().is_none() {
            return None;
        }

        match key.as_str() {
            "image" => {
                Some(Metadata::String(storage.image.get(asset).read_slice().unwrap()))
            },
            _ => None,
        }
    }
}

impl SRC3 for Contract {
    #[storage(read, write)]
    fn mint(recipient: Identity, sub_id: Option<SubId>, amount: u64) {
        require(sub_id.is_some(), "Sub ID is required");
        let sub_id = sub_id.unwrap();
        let asset_id = AssetId::new(ContractId::this(), sub_id);
        let current_supply = storage.total_supply.get(asset_id).try_read().unwrap_or(0);
        let new_supply = current_supply + amount;
        storage.total_supply.insert(asset_id, new_supply);
        mint_to(recipient, sub_id, amount);
        TotalSupplyEvent::new(asset_id, new_supply, recipient).log();
        log(MintEvent {
            asset_id,
            recipient,
            amount,
        }); 
    }

    #[storage(read, write), payable]
    fn burn(sub_id: SubId, amount: u64) {
        let asset_id = AssetId::new(ContractId::this(), sub_id);
        let current_supply = storage.total_supply.get(asset_id).try_read().unwrap_or(0);
        let new_supply = current_supply - amount;
        storage.total_supply.insert(asset_id, new_supply);
        burn(sub_id, amount);
        let sender = msg_sender().unwrap();
        TotalSupplyEvent::new(asset_id, new_supply, sender).log();
        log(BurnEvent {
            asset_id,
            sender,
            amount,
        });
    }
}


// ------ LAUNCHPAD -------

impl Launchpad for Contract {

    #[storage(read, write)]
    fn initialize(owner: Identity) {
        require(storage.owner.read() == State::Uninitialized, "Contract already initialized");
        storage.owner.write(State::Initialized(owner));
    }

    #[storage(read, write)]
    fn set_owner(owner: Identity) {
        require_owner(storage.owner.read());
        storage.owner.write(State::Initialized(owner));
    }

    #[storage(read)]
    /// Returns metadata for all created assets.
    /// Iterates storage.assets and resolves TokenInfo for each asset id.
    fn get_assets() -> Vec<TokenInfo> {
        let mut assets : Vec<TokenInfo> = Vec::new();
        let mut i = 0;
        while i < storage.assets.len() {
            let asset_id = storage.assets.get(i).unwrap().read();
            let token_info = read_token_info(asset_id);
            assets.push(token_info);
            i += 1;
        }
        assets
    }

    #[storage(read)]
    /// Returns all stored campaigns.
    /// Iterates storage.assets and collects Campaigns that exist.
    fn get_campaigns() -> Vec<Campaign> {
        let mut campaigns: Vec<Campaign> = Vec::new();
        let mut i = 0;
        while i < storage.assets.len() {
            let asset_id = storage.assets.get(i).unwrap().read();
            if let Some(campaign) = storage.campaigns.get(asset_id).try_read() {
                campaigns.push(campaign);
            }
            i += 1;
        }
        campaigns
    }

    #[storage(read, write), payable]
    /// Creates a new campaign and initializes its metadata.
    /// Generates deterministic sub_id from (counter, sender).
    fn create_campaign(
        name: String,
        ticker: String,
        description: String,
        image: String,
    ) -> AssetId {
        let sender = msg_sender().unwrap();
        require(can_create_campaign(sender), "Already has active campaign");

        let counter = storage.campaign_counter.read();
        let sub_id = sha256((counter, sender));
        let asset_id = AssetId::new(ContractId::this(), sub_id);

        storage.name.get(asset_id).write_slice(name);
        storage.ticker.get(asset_id).write_slice(ticker);
        storage.description.get(asset_id).write_slice(description);
        storage.image.get(asset_id).write_slice(image);
        storage.decimals.get(asset_id).write(DEFAULT_DECIMALS);

        let curve_supply = (INITIAL_SUPPLY / 100) * CURVE_SUPPLY_PERCENT;
        let curve = BondingCurve::new(curve_supply);
        let campaign = Campaign {
            target: MIGRATION_TARGET,
            creator: sender,
            status: CampaignStatus::Active,
            token_id: asset_id,
            total_pledged: 0,
            curve_reserve: 0,
            total_supply: 0,
            sub_id: sub_id,
            curve: curve,
            amm_reserved: 0,
            boost: None,
        };
        storage.campaigns.insert(asset_id, campaign);
        storage.campaign_counter.write(counter + 1);
        storage.assets.push(asset_id);
        log(CampaignCreatedEvent {
            asset_id,
            creator: sender,
            sub_id,
            target: MIGRATION_TARGET,
            token_info: read_token_info(asset_id),
        });

        let msg_amount = msg_amount();
        let cinder_asset_id = cinder_asset_id();
        if msg_amount > 0 {
            require(msg_asset_id() == cinder_asset_id, "Sent asset is not the cinder asset");
            _boost_campaign(asset_id, msg_amount);
        }
        asset_id
    }

    #[storage(read, write)]
    /// yies an active campaign and refunds all pledges.
    /// Only valid for Active campaigns.
    fn deny_campaign(
        asset_id: AssetId,
    ) -> bool {
        require_owner(storage.owner.read());
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        
        require(campaign.status == CampaignStatus::Active, "Campaign is not active");
        let sender = msg_sender().unwrap();
        campaign.status = CampaignStatus::Denied;
        storage.campaigns.insert(asset_id, campaign);

        log(CampaignDeniedEvent {
            asset_id,
            sender,
        });
        
        true
    }

    #[storage(read, write)]
    /// Launches a campaign: initializes curve, mints full supply to contract.
    /// Owner-only; campaign must be active and have pledges.
    fn launch_campaign(asset_id: AssetId) -> bool {
        require_owner(storage.owner.read());
        let sender = msg_sender().unwrap();
        let campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        do_launch(asset_id, campaign, sender)
    }

    #[storage(read, write)]
    /// Claims user allocation after launch.
    /// User can claim only once; returns false if no pledge found.
    fn claim(asset_id: AssetId) -> bool {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        let sender = msg_sender().unwrap();

        require(campaign.status == CampaignStatus::Launched, "Not launched");

        let pledges_vec = storage.pledges.get(asset_id);
        let pledges_len = pledges_vec.len();
        let mut i = 0;
        while i < pledges_len {
            let mut pledge = pledges_vec.get(i).unwrap().read();
            if pledge.sender == sender {
                require(!pledge.claimed, "Already claimed");
                let users_share = campaign.curve.sold_supply;
                let user_share = {
                    let pledged_256 = u256::from(pledge.amount);
                    let users_share_256 = u256::from(users_share);
                    let total_pledged_256 = u256::from(campaign.total_pledged);
                    let share = (pledged_256 * users_share_256) / total_pledged_256;
                    u256_to_u64(share)
                };
                transfer(sender, asset_id, user_share);
                pledge.claimed = true;
                pledges_vec.set(i, pledge);
                log(ClaimEvent {
                    asset_id,
                    sender,
                    amount: user_share,
                });
                return true;
            }
            i += 1;
        }

        false
    }

    #[storage(read, write)]
    /// Migrates a token to Reactor DEX
    fn migrate(asset_id: AssetId) -> bool {
        require_owner(storage.owner.read());
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        require(campaign.status == CampaignStatus::Launched, "Not launched");
        let sender = msg_sender().unwrap();
        transfer(sender, asset_id, campaign.amm_reserved);
        transfer(sender, pledge_asset_id(), campaign.curve_reserve);

        log(CampaignMigratedEvent {
            asset_id,
            sender,
            base_reserve: campaign.curve_reserve,
            token_reserve: campaign.amm_reserved,
        });

        campaign.status = CampaignStatus::Migrated;
        storage.campaigns.insert(asset_id, campaign);
        true
    }

    #[storage(read, write)]
    /// Refunds user pledge after campaign denial.
    /// User can refund only once; returns false if no pledge found.
    fn refund_pledge(asset_id: AssetId) -> bool {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        let sender = msg_sender().unwrap();

        require(campaign.status == CampaignStatus::Denied, "Not denied");

        let pledges_vec = storage.pledges.get(asset_id);
        let pledges_len = pledges_vec.len();
        let mut i = 0;
        while i < pledges_len {
            let mut pledge = pledges_vec.get(i).unwrap().read();
            if pledge.sender == sender {
                require(!pledge.claimed, "Already claimed");
                transfer(sender, pledge_asset_id(), pledge.amount);
                pledge.claimed = true;
                pledges_vec.set(i, pledge);
                return true;
            }
            i += 1;
        }

        false
    }

    #[storage(read, write)]
    #[payable]
    /// Buys tokens from bonding curve using the sent base-asset budget.
    fn buy(asset_id: AssetId) -> u64 {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        let sender = msg_sender().unwrap();

        require(campaign.status == CampaignStatus::Launched, "Not launched");

        let sent_asset = msg_asset_id();
        let pledge_asset = pledge_asset_id();
        require(sent_asset == pledge_asset, "Sent asset is not the pledge asset");

        let budget = msg_amount();
        require(budget > 0, "Budget must be greater than 0");

        let best = campaign.curve.tokens_for_budget(budget);
        require(best > 0, "Budget too low");
        let cost = campaign.curve.buy_cost(best);
        let _ = campaign.curve.buy(best);
        campaign.curve_reserve += cost;
        storage.campaigns.insert(asset_id, campaign);

        if budget > cost {
            transfer(sender, pledge_asset_id(), budget - cost);
        }
        transfer(sender, asset_id, best);
        log(BuyEvent {
            asset_id,
            sender,
            amount: best,
            cost,
            sold_supply: campaign.curve.sold_supply,
            curve_reserve: campaign.curve_reserve,
        });
        cost
    }

    #[storage(read, write)]
    #[payable]
    /// Sells tokens back to bonding curve.
    /// Caller sends token amount via msg_amount; receives payout in pledge asset.
    fn sell(asset_id: AssetId) -> u64 {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        let sender = msg_sender().unwrap();

        require(campaign.status == CampaignStatus::Launched, "Not launched");

        let sent_asset = msg_asset_id();
        require(sent_asset == asset_id, "Sent asset is not the token");

        let amount = msg_amount();
        require(amount > 0, "Amount must be greater than 0");

        let payout = campaign.curve.sell_payout(amount);
        require(payout > 0, "Payout is zero");
        require(campaign.curve_reserve >= payout, "Insufficient curve reserve");

        let _ = campaign.curve.sell(amount);
        campaign.curve_reserve -= payout;
        storage.campaigns.insert(asset_id, campaign);

        transfer(sender, pledge_asset_id(), payout);
        log(SellEvent {
            asset_id,
            sender,
            amount,
            payout,
            sold_supply: campaign.curve.sold_supply,
            curve_reserve: campaign.curve_reserve,
        });
        payout
    }

    #[storage(read, write)]
    #[payable]
    /// Pledges base asset to an active campaign.
    /// Enforces max pledge per user and exact msg_amount.
    fn pledge(
        asset_id: AssetId,
        amount: u64,
    ) -> bool {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        let sender = msg_sender().unwrap();
        
        require(campaign.status == CampaignStatus::Active, "Campaign is not active");
        require(campaign.creator != sender, "Creator cannot pledge");
        require(amount > 0, "Amount must be greater than 0");

        let sent_asset = msg_asset_id();
        let pledge_asset = pledge_asset_id();
        require(sent_asset == pledge_asset, "Sent asset is not the pledge asset");

        let sent_amount = msg_amount();
        require(sent_amount == amount, "Sent amount is not the pledge amount");
        
        let pledges_vec = storage.pledges.get(asset_id);
        let pledges_len = pledges_vec.len();
        
        let mut found_index = None::<u64>;
        let mut current_amount: u64 = 0;
        
        let mut i = 0;
        while i < pledges_len {
            if found_index.is_none() {
                let pledge = pledges_vec.get(i).unwrap().read();
                if pledge.sender == sender {
                    found_index = Some(i);
                    current_amount = pledge.amount;
                }
            }
            i += 1;
        }
        
        match found_index {
            Some(index) => {
                let new_total = current_amount + amount;
                // require(new_total <= MAX_PLEDGE_AMOUNT, "Total pledge exceeds MAX_PLEDGE_AMOUNT");
                
                let updated_pledge = Pledge {
                    amount: new_total,
                    sender,
                    asset_id,
                    claimed: false,
                };
                pledges_vec.set(index, updated_pledge);
            },
            None => {
                // require(amount <= MAX_PLEDGE_AMOUNT, "Amount exceeds MAX_PLEDGE_AMOUNT");
                
                let new_pledge = Pledge {
                    amount,
                    sender,
                    asset_id,
                    claimed: false,
                };
                pledges_vec.push(new_pledge);
            },
        }
        
        campaign.total_pledged += amount;
        if is_instant_launch_ready(campaign.total_pledged) {
            do_launch(asset_id, campaign, sender);
        } else {
            storage.campaigns.insert(asset_id, campaign);
        }
        log(PledgedEvent {
            asset_id,
            sender,
            amount,
            total_pledged: campaign.total_pledged,
        });
        
        true
    }

    #[storage(read)]
    /// Returns pledged amount for a user and campaign.
    fn get_pledge(
        asset_id: AssetId,
        sender: Identity,
    ) -> u64 {
        let pledges_vec = storage.pledges.get(asset_id);
        let pledges_len = pledges_vec.len();
        let mut i = 0;
        while i < pledges_len {
            let pledge = pledges_vec.get(i).unwrap().read();
            if pledge.sender == sender {
                return pledge.amount;
            }
            i += 1;
        }
        0
    }

    #[storage(read)]
    /// Returns total pledged amount for a campaign.
    fn get_total_pledged(
        asset_id: AssetId,
    ) -> u64 {
        let pledges_vec = storage.pledges.get(asset_id);
        let pledges_len = pledges_vec.len();
        let mut total_pledged = 0;
        let mut i = 0;
        while i < pledges_len {
            let pledge = pledges_vec.get(i).unwrap().read();
            total_pledged += pledge.amount;
            i += 1;
        }
        total_pledged
    }


    #[storage(read)]
    /// Returns campaign by asset id (reverts if not found).
    fn get_campaign(
        asset_id: AssetId,
    ) -> Campaign {
        storage.campaigns.get(asset_id).try_read().unwrap()
    }

    #[storage(read)]
    /// Returns total number of campaigns created.
    fn get_campaign_counter() -> u64 {
        storage.campaign_counter.read()
    }

    #[storage(read)]
    /// Returns token info for asset id.
    fn get_token_info(
        asset_id: AssetId
    ) -> TokenInfo {
        read_token_info(asset_id)
    }

    #[storage(read, write)]
    fn mint_cinder(recipient: Identity, amount: u64) -> bool {
        let cinder = abi(CinderToken, CINDER_CONTRACT_ID);
        cinder.mint_cinder(recipient, amount);
        true
    }

    #[storage(read, write), payable]
    fn boost_campaign(asset_id: AssetId, burn_amount: u64) -> Boost {
        _boost_campaign(asset_id, burn_amount)
    }
}
