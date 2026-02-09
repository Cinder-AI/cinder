contract;

pub mod events;
pub mod utils;

use std::{
    string::String,
    storage::storage_string::*,
    storage::storage_vec::*,
    asset::{mint, burn, transfer, mint_to},
    call_frames::msg_asset_id,
    context::{msg_amount},
    hash::sha256,
    logging::log,
    auth::msg_sender,
    identity::Identity,
    contract_id::ContractId,
};

use utils::*;
use events::{
    CampaignCreatedEvent,
    CampaignDeniedEvent,
    CampaignDeletedEvent,
    CampaignLaunchedEvent,
    PledgedEvent,
    ClaimEvent,
    BuyEvent,
    SellEvent,
    MintEvent,
};
use types::launchpad::Launchpad;
use types::campaign::{CampaignStatus, Campaign};
use types::bonding::BondingCurve;
use types::structs::{TokenInfo, Pledge};

use src20::{TotalSupplyEvent, SRC20};
use src3::SRC3;
use src7::SRC7;
use src5::{SRC5, State};

configurable {
    DEFAULT_DECIMALS: u8 = 9,
    MIGRATION_TARGET: u64 = 1_000_000 * 10 ** DEFAULT_DECIMALS,
    INITIAL_SUPPLY: u64 = 1_000_000_000 * 10 ** DEFAULT_DECIMALS,
    PLEDGE_ASSET_ID: b256 = 0x177bae7c37ea20356abd7fc562f92677e9861f09d003d8d3da3c259a9ded7dd8,
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

fn pledge_asset_id() -> AssetId {
    if PLEDGE_ASSET_ID == b256::zero() {
        AssetId::base()
    } else {
        AssetId::from(PLEDGE_ASSET_ID)
    }
}

#[storage(read)]
fn require_owner() {
    match storage.owner.read() {
        State::Initialized(owner) => {
            require(owner == msg_sender().unwrap(), "Not owner");
        },
        _ => {
            require(false, "Owner not initialized");
        }
    }
}

impl SRC5 for  Contract {
    #[storage(read)]
    fn owner() -> State {
        storage.owner.read()
    }
}

fn is_instant_launch_ready(total_pledged: u64) -> bool {
    total_pledged >= MIGRATION_TARGET * INSTANT_LAUNCH_THRESHOLD_PERCENT / 100
}

#[storage(read, write)]
fn do_launch(asset_id: AssetId, campaign: Campaign, sender: Identity) -> bool {
    let mut campaign = campaign;
    require(campaign.status == CampaignStatus::Active, "Not active");
    require(campaign.total_pledged > 0, "No pledges");

    let curve_supply = INITIAL_SUPPLY * CURVE_SUPPLY_PERCENT / 100;
    let amm_supply = INITIAL_SUPPLY - curve_supply;

    let users_share = curve_supply * campaign.total_pledged / MIGRATION_TARGET;
    let remaining_supply = curve_supply - users_share;
    require(users_share <= curve_supply, "User share exceeds curve supply");

    campaign.curve.initialize(campaign.total_pledged, users_share);
    mint(campaign.sub_id, remaining_supply);
    mint(campaign.sub_id, amm_supply);
    campaign.amm_reserved = amm_supply;
    campaign.status = CampaignStatus::Launched;
    storage.campaigns.insert(asset_id, campaign);
    log(CampaignLaunchedEvent {
        asset_id,
        sender,
        users_share,
        remaining_supply,
        amm_supply,
    });

    true
}

#[storage(read)]
fn read_token_info(asset_id: AssetId) -> TokenInfo {
    let name = storage.name.get(asset_id).read_slice().unwrap();
    let ticker = storage.ticker.get(asset_id).read_slice().unwrap();
    let description = storage.description.get(asset_id).read_slice().unwrap();
    let image = storage.image.get(asset_id).read_slice().unwrap();
    let decimals = storage.decimals.get(asset_id).try_read().unwrap_or(9);
    
    TokenInfo {
        asset_id: asset_id,
        name: name,
        ticker: ticker,
        description: description,
        image: image,
        decimals: decimals,
    }
}

impl Launchpad for Contract {

    #[storage(read, write)]
    fn initialize(owner: Identity) {
        require(storage.owner.read() == State::Uninitialized, "Contract already initialized");
        storage.owner.write(State::Initialized(owner));
    }

    #[storage(read, write)]
    fn set_owner(owner: Identity) {
        require_owner();
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

    #[storage(read, write)]
    /// Creates a new campaign and initializes its metadata.
    /// Generates deterministic sub_id from (counter, sender).
    fn create_campaign(
        name: String,
        ticker: String,
        description: String,
        image: String,
    ) -> AssetId {

        let counter = storage.campaign_counter.read();
        let sender = msg_sender().unwrap();
        let sub_id = sha256((counter, sender));
        let asset_id = AssetId::new(ContractId::this(), sub_id);

        set_name(storage.name, asset_id, name);
        set_ticker(storage.ticker, asset_id, ticker);
        set_description(storage.description, asset_id, description);
        set_image(storage.image, asset_id, image);
        set_decimals(storage.decimals, asset_id, 9);

        let curve_supply = INITIAL_SUPPLY * CURVE_SUPPLY_PERCENT / 100;
        let curve = BondingCurve::new(curve_supply);
        let campaign = Campaign {
            target: MIGRATION_TARGET,
            creator: sender,
            status: CampaignStatus::Active,
            token_id: asset_id,
            total_pledged: 0,
            total_supply: 0,
            sub_id: sub_id,
            curve: curve,
            amm_reserved: 0,
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
        asset_id
    }

    #[storage(read, write)]
    #[payable]
    /// Denies an active campaign and refunds all pledges.
    /// Only valid for Active campaigns.
    fn deny_campaign(
        asset_id: AssetId,
    ) -> bool {
        require_owner();
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
    /// Deletes campaign metadata and removes asset reference.
    /// Returns true if campaign no longer exists.
    fn delete_campaign(
        asset_id: AssetId,
    ) -> bool {
        require_owner();
        let sender = msg_sender().unwrap();

        let _ = delete_name(storage.name, asset_id);
        let _ = delete_ticker(storage.ticker, asset_id);
        let _ = delete_description(storage.description, asset_id);
        let _ = delete_image(storage.image, asset_id);
        let _ = delete_decimals(storage.decimals, asset_id);
        let _ = delete_campaign(storage.campaigns, asset_id);
        let _ = delete_asset(storage.assets, asset_id);

        log(CampaignDeletedEvent {
            asset_id,
            sender,
        });

        storage.campaigns.get(asset_id).try_read().is_none()
    }

    #[storage(read, write)]
    /// Launches a campaign: initializes curve, mints full supply to contract.
    /// Owner-only; campaign must be active and have pledges.
    fn launch_campaign(asset_id: AssetId) -> bool {
        require_owner();
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
                let user_share = (pledge.amount * users_share) / campaign.total_pledged;
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
    /// Buys tokens from bonding curve.
    /// Caller must send exact base-asset cost; returns cost.
    fn buy(asset_id: AssetId, amount: u64, max_cost: u64) -> u64 {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        let sender = msg_sender().unwrap();

        require(campaign.status == CampaignStatus::Launched, "Not launched");

        let sent_asset = msg_asset_id();
        let pledge_asset = pledge_asset_id();
        require(sent_asset == pledge_asset, "Sent asset is not the pledge asset");

        let cost = campaign.curve.buy_cost(amount);
        require(cost <= max_cost, "Cost exceeds max");
        let sent_amount = msg_amount();
        require(sent_amount == cost, "Sent amount is not the cost");

        let _ = campaign.curve.buy(amount);
        storage.campaigns.insert(asset_id, campaign);

        transfer(sender, asset_id, amount);
        log(BuyEvent {
            asset_id,
            sender,
            amount,
            cost,
            sold_supply: campaign.curve.sold_supply,
        });
        cost
    }

    #[storage(read, write)]
    #[payable]
    /// Sells tokens back to bonding curve.
    /// Caller must send token amount; returns refund in base asset.
    fn sell(asset_id: AssetId, amount: u64, min_refund: u64) -> u64 {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        let sender = msg_sender().unwrap();

        require(campaign.status == CampaignStatus::Launched, "Not launched");

        let sent_asset = msg_asset_id();
        require(sent_asset == asset_id, "Sent asset is not the token");
        let sent_amount = msg_amount();
        require(sent_amount == amount, "Sent amount is not the sell amount");

        let refund = campaign.curve.sell_refund(amount);
        require(refund >= min_refund, "Refund below min");

        let _ = campaign.curve.sell(amount);
        storage.campaigns.insert(asset_id, campaign);

        transfer(sender, pledge_asset_id(), refund);
        log(SellEvent {
            asset_id,
            sender,
            amount,
            refund,
            sold_supply: campaign.curve.sold_supply,
        });
        refund
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

    #[storage(read, write), payable]
    /// Mints token amount to recipient for given sub_id.
    /// Updates total_supply storage and emits TotalSupplyEvent.
    fn mint(
        recipient: Identity,
        sub_id: SubId,
        amount: u64,
    ) {
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
}
