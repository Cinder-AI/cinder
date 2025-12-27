library;

pub enum CampaignStatus {
    Active: (),
    Launched: (),
    Failed: (),
}

impl PartialEq for CampaignStatus {
    fn eq(self, other: Self) -> bool {
        match (self, other) {
            (CampaignStatus::Active, CampaignStatus::Active) => true,
            (CampaignStatus::Launched, CampaignStatus::Launched) => true,
            (CampaignStatus::Failed, CampaignStatus::Failed) => true,
            _ => false,
        }
    }
}

impl Eq for CampaignStatus {

}

pub struct Campaign {
    pub target: u64,
    pub creator: Identity,
    pub status: CampaignStatus,
    pub token_id: AssetId,
    pub sub_id: SubId,
    pub total_pledged: u64, 
    pub total_supply: u64,
}