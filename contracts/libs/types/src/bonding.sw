library;

pub struct BondingCurve {
    pub sold_supply: u64,       // tokens already sold via bonding curve
    pub max_supply: u64,        // total curve supply
    pub base_price: u64,        // start price, when current_supply is 0
    pub slope_per_token: u64    // price increase per token sold
}

impl BondingCurve {
    pub fn new(sold_supply: u64, max_supply: u64, base_price: u64, slope_per_token: u64) -> Self {
        Self { sold_supply, max_supply, base_price, slope_per_token }
    }

    pub fn current_price(&self) -> u64 {
        self.base_price + self.slope_per_token * self.sold_supply
    }
    
    pub fn remaining_supply(&self) -> u64 {
        self.max_supply - self.sold_supply
    }

    pub fn is_filled(&self) -> bool {
        self.sold_supply >= self.max_supply
    }

    pub fn buy(&mut self, amount: u64) -> bool {
        require(!self.is_filled(), "Bonding curve is filled");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= self.remaining_supply(), "Amount exceeds remaining supply");

        self.sold_supply += amount;
        true
    }

    pub fn sell(&mut self, amount: u64) -> bool {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= self.sold_supply, "Amount exceeds sold supply");

        self.sold_supply -= amount;
        true
    }
}