library;

pub struct BondingCurve {
    pub sold_supply: u64,       // tokens already sold via bonding curve
    pub max_supply: u64,        // total curve supply
    pub base_price: u64,
    pub slope: u64
}

const PRICE_SCALE: u64 = 1_000_000_000;
impl BondingCurve {
    pub fn new(max_supply: u64) -> Self {
        Self { sold_supply: 0, max_supply, base_price: 0, slope: 0 }
    }

    pub fn initialize(ref mut self, total_pledged: u64, users_share: u64) {
        self.sold_supply = users_share;
        let avg_price = (total_pledged * PRICE_SCALE) / users_share;
        self.slope = avg_price / self.max_supply;

        let slope_component = (self.slope * users_share * users_share) / 2;
        let numerator = total_pledged * PRICE_SCALE - slope_component;
        self.base_price = numerator / users_share;
    }

    pub fn supply(self) -> u64 {
        self.max_supply - self.sold_supply
    }

    pub fn current_price(self) -> u64 {
        self.base_price + self.slope * self.sold_supply
    }
    
    pub fn remaining_supply(self) -> u64 {
        self.max_supply - self.sold_supply
    }

    pub fn is_filled(self) -> bool {
        self.sold_supply >= self.max_supply
    }

    pub fn buy(ref mut self, amount: u64) -> bool {
        require(!self.is_filled(), "Bonding curve is filled");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= self.remaining_supply(), "Amount exceeds remaining supply");

        self.sold_supply += amount;
        true
    }

    pub fn sell(ref mut self, amount: u64) -> bool {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= self.sold_supply, "Amount exceeds sold supply");

        self.sold_supply -= amount;
        true
    }

    pub fn buy_cost(self, amount: u64) -> u64 {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= self.remaining_supply(), "Amount exceeds remaining supply");

        let s = self.sold_supply;
        let delta = amount;
        let base = self.base_price;
        let slope = self.slope;

        let s_after = s + delta;
        let area = (s_after * s_after) - (s * s);
        let cost_scaled = base * delta + (slope * area) / 2;
        cost_scaled / PRICE_SCALE
    }

    pub fn sell_refund(self, amount: u64) -> u64 {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= self.sold_supply, "Amount exceeds sold supply");

        let s = self.sold_supply;
        let delta = amount;
        let base = self.base_price;
        let slope = self.slope;

        let s_before = s - delta;
        let area = (s * s) - (s_before * s_before);
        let refund_scaled = base * delta + (slope * area) / 2;
        refund_scaled / PRICE_SCALE
    }
}