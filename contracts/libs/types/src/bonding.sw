library;

use std::assert::assert;

pub struct BondingCurve {
    pub sold_supply: u64,       // tokens already sold via bonding curve
    pub max_supply: u64,        // total curve supply
    pub base_price: u64,
    pub slope: u64
}

const PRICE_SCALE: u256 = 1_000_000_000u256;

fn u256_to_u64(val: u256) -> u64 {
    let (a, b, c, d): (u64, u64, u64, u64) = asm(r1: val) {
        r1: (u64, u64, u64, u64)
    };
    assert(a == 0);
    assert(b == 0);
    assert(c == 0);
    d
}
impl BondingCurve {
    pub fn new(max_supply: u64) -> Self {
        Self { sold_supply: 0, max_supply, base_price: 0, slope: 0 }
    }

    pub fn initialize(ref mut self, total_pledged: u64, users_share: u64) {
        self.sold_supply = users_share;
        let total_pledged_256 = u256::from(total_pledged);
        let users_share_256 = u256::from(users_share);
        let max_supply_256 = u256::from(self.max_supply);

        let avg_price = (total_pledged_256 * PRICE_SCALE) / users_share_256;
        let slope = avg_price / max_supply_256;

        let slope_component = (slope * users_share_256 * users_share_256) / 2;
        let numerator = total_pledged_256 * PRICE_SCALE - slope_component;
        let base_price = numerator / users_share_256;

        self.slope = u256_to_u64(slope);
        self.base_price = u256_to_u64(base_price);
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

        let s = u256::from(self.sold_supply);
        let delta = u256::from(amount);
        let base = u256::from(self.base_price);
        let slope = u256::from(self.slope);

        let s_after = s + delta;
        let area = (s_after * s_after) - (s * s);
        let cost_scaled = base * delta + (slope * area) / 2;
        let cost = cost_scaled / PRICE_SCALE;
        u256_to_u64(cost)
    }

    pub fn sell_refund(self, amount: u64) -> u64 {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= self.sold_supply, "Amount exceeds sold supply");

        let s = u256::from(self.sold_supply);
        let delta = u256::from(amount);
        let base = u256::from(self.base_price);
        let slope = u256::from(self.slope);

        let s_before = s - delta;
        let area = (s * s) - (s_before * s_before);
        let refund_scaled = base * delta + (slope * area) / 2;
        let refund = refund_scaled / PRICE_SCALE;
        u256_to_u64(refund)
    }
}