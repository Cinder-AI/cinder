contract;

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
use types::launchpad::Launchpad;
use types::campaign::{CampaignStatus, Campaign};
use types::structs::{TokenInfo, Pledge};
use types::amm::AMM;

use src20::{TotalSupplyEvent, SRC20};
use src3::SRC3;
use src7::SRC7;

configurable {
    MIGRATION_TARGET: u64 = 1_000_000,
    MAX_PLEDGE_AMOUNT: u64 = 20_000,
    PLEDGE_ASSET_ID: b256 = 0x0000000000000000000000000000000000000000000000000000000000000000,
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
    amm_initialized: bool = false,
}

fn pledge_asset_id() -> AssetId {
    if PLEDGE_ASSET_ID == b256::zero() {
        AssetId::base()
    } else {
        AssetId::from(PLEDGE_ASSET_ID)
    }
}

#[storage(read)]
fn read_token_info(asset_id: AssetId) -> TokenInfo {
    let name = storage.name.get(asset_id).read_slice().unwrap();
    let ticker = storage.ticker.get(asset_id).read_slice().unwrap();
    let description = storage.description.get(asset_id).read_slice().unwrap();
    let image = storage.image.get(asset_id).read_slice().unwrap();
    
    TokenInfo {
        asset_id: asset_id,
        name: name,
        ticker: ticker,
        description: description,
        image: image,
    }
}

impl Launchpad for Contract {

    #[storage(read)]
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


        let campaign = Campaign {
            target: MIGRATION_TARGET,
            creator: sender,
            status: CampaignStatus::Active,
            token_id: asset_id,
            total_pledged: 0,
            total_supply: 0,
            sub_id: sub_id,
        };
        storage.campaigns.insert(asset_id, campaign);
        storage.campaign_counter.write(counter + 1);
        storage.assets.push(asset_id);
        asset_id
    }

    #[storage(read, write)]
    #[payable]
    fn deny_campaign(
        asset_id: AssetId,
    ) -> bool {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        
        require(campaign.status == CampaignStatus::Active, "Campaign is not active");
        
        let pledges_vec = storage.pledges.get(asset_id);
        let pledges_len = pledges_vec.len();
        
        let pledge_asset = pledge_asset_id();
        let mut i = 0;
        while i < pledges_len {
            let pledge = pledges_vec.get(i).unwrap().read();            
            
            // Возвращаем средства пользователю
            transfer(pledge.sender, pledge_asset, pledge.amount);
            
            i += 1;
        }
        
        campaign.status = CampaignStatus::Failed;
        storage.campaigns.insert(asset_id, campaign);
        
        true
    }

    #[storage(read, write)]
    fn delete_campaign(
        asset_id: AssetId,
    ) -> bool {
        let _ = delete_name(storage.name, asset_id);
        let _ = delete_ticker(storage.ticker, asset_id);
        let _ = delete_description(storage.description, asset_id);
        let _ = delete_image(storage.image, asset_id);
        let _ = delete_decimals(storage.decimals, asset_id);
        let _ = delete_campaign(storage.campaigns, asset_id);
        let _ = delete_asset(storage.assets, asset_id);


        storage.campaigns.get(asset_id).try_read().is_none()
    }

    #[storage(read, write)]
    fn launch_campaign(asset_id: AssetId, _amm_contract_id: ContractId) -> bool {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        let sender = msg_sender().unwrap();
        
        // Проверки
        require(campaign.status == CampaignStatus::Active, "Not active");
        require(campaign.creator == sender, "Only creator can launch");
        require(campaign.total_pledged > 0, "No pledges");
        
        // 1. Минтим токены участникам
        let initial_supply = 1_000_000_000; // например, 1 млрд токенов
        let liquidity_percent = 20; // 20% в пул
        let distribution_supply = initial_supply * (100 - liquidity_percent) / 100;
        
        let pledges_vec = storage.pledges.get(asset_id);
        let mut i = 0;
        while i < pledges_vec.len() {
            let pledge = pledges_vec.get(i).unwrap().read();
            let user_share = (pledge.amount * distribution_supply) / campaign.total_pledged;
            
            // Минтим токены
            
            mint_to(pledge.sender, campaign.sub_id, user_share);
            
            i += 1;
        }
        
        // 2. Создаем ликвидность в AMM
        let liquidity_tokens = initial_supply * liquidity_percent / 100;
        mint(campaign.sub_id, liquidity_tokens);

        let pledge_asset = pledge_asset_id();
        let to_amm = Identity::ContractId(_amm_contract_id);
        let total_pledged = campaign.total_pledged;
        let need_init = !storage.amm_initialized.read();

        if need_init {
            storage.amm_initialized.write(true);
        }

        campaign.status = CampaignStatus::Launched;
        campaign.total_supply = initial_supply;
        storage.campaigns.insert(asset_id, campaign);

        transfer(to_amm, pledge_asset, total_pledged);
        transfer(to_amm, asset_id, liquidity_tokens);

        if need_init {
            abi(AMM, _amm_contract_id.into()).initialize(Identity::ContractId(ContractId::this()));
        }
        abi(AMM, _amm_contract_id.into()).set_owner(Identity::ContractId(ContractId::this()));

        let pool_id = abi(AMM, _amm_contract_id.into()).create_pool(pledge_asset, asset_id);
        let _ = abi(AMM, _amm_contract_id.into()).add_liquidity(pool_id, total_pledged, liquidity_tokens);
        
        true
    }

    #[storage(read, write)]
    #[payable]
    fn pledge(
        asset_id: AssetId,
        amount: u64,
    ) -> bool {
        let mut campaign = storage.campaigns.get(asset_id).try_read().unwrap();
        let sender = msg_sender().unwrap();
        
        // Проверяем базовые условия
        require(campaign.status == CampaignStatus::Active, "Campaign is not active");
        require(campaign.creator != sender, "Creator cannot pledge");
        require(amount > 0, "Amount must be greater than 0");

        let sent_asset = msg_asset_id();
        let pledge_asset = pledge_asset_id();
        require(sent_asset == pledge_asset, "Sent asset is not the pledge asset");

        let sent_amount = msg_amount();
        require(sent_amount == amount, "Sent amount is not the pledge amount");
        
        // Получаем StorageVec залогов для данного токена
        let pledges_vec = storage.pledges.get(asset_id);
        let pledges_len = pledges_vec.len();
        
        // Ищем существующий залог пользователя
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
        
        // Проверяем лимиты и обновляем
        match found_index {
            Some(index) => {
                // Залог уже существует - обновляем
                let new_total = current_amount + amount;
                require(new_total <= MAX_PLEDGE_AMOUNT, "Total pledge exceeds MAX_PLEDGE_AMOUNT");
                
                let updated_pledge = Pledge {
                    amount: new_total,
                    sender,
                    asset_id,
                };
                pledges_vec.set(index, updated_pledge);
            },
            None => {
                // Первый залог - добавляем новый
                require(amount <= MAX_PLEDGE_AMOUNT, "Amount exceeds MAX_PLEDGE_AMOUNT");
                
                let new_pledge = Pledge {
                    amount,
                    sender,
                    asset_id,
                };
                pledges_vec.push(new_pledge);
            },
        }
        
        // Обновляем total_pledged в кампании
        campaign.total_pledged += amount;
        storage.campaigns.insert(asset_id, campaign);
        
        true
    }

    #[storage(read)]
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
    fn get_campaign(
        asset_id: AssetId,
    ) -> Campaign {
        storage.campaigns.get(asset_id).try_read().unwrap()
    }

    #[storage(read)]
    fn get_campaign_counter() -> u64 {
        storage.campaign_counter.read()
    }

    #[storage(read)]
    fn get_token_info(
        asset_id: AssetId
    ) -> TokenInfo {
        read_token_info(asset_id)
    }

    #[storage(read, write), payable]
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
    }
}

// impl SRC20 for Contract {
//     #[storage(read)]
//     fn total_assets() -> u64 {
//         storage.campaign_counter.read()
//     }
    
//     #[storage(read)]
//     fn total_supply(asset: AssetId) -> Option<u64> {
//         storage.total_supplies.get(asset).try_read()
//     }
    
//     #[storage(read)]
//     fn name(asset: AssetId) -> Option<StorageString> {
//         match storage.name.get(asset).try_read() {
//             Some(name) => Some(name),
//             None => None,
//         }
//     }

//     #[storage(read)]
//     fn symbol(asset: AssetId) -> Option<StorageString> {
//         match storage.ticker.get(asset).try_read() {
//             Some(ticker) => Some(ticker),
//             None => None,
//         }
//     }
        
//     #[storage(read)]
//     fn decimals(asset: AssetId) -> Option<u8> {
//         match storage.token_info.get(asset).try_read() {
//             Some(info) => Some(info.decimals),
//             None => None,
//         }
//     }
// }