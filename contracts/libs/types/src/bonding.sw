library;

use std::assert::assert;
use utils::*;

pub struct BondingCurve {
    pub sold_supply: u64,       // tokens already sold via bonding curve
    pub max_supply: u64,        // total curve supply
    pub base_price: u64,
    pub slope: u64
}

const PRICE_SCALE: u256 = 1_000_000_000u256;
const SLOPE_SCALE: u256 = PRICE_SCALE * PRICE_SCALE;
const TWO_U256: u256 = 2u256;

fn sqrt_u256(x: u256) -> u256 {
    if x == 0u256 {
        return 0u256;
    }
    let mut z = x;
    let mut y = (x + 1u256) / 2u256;
    while y < z {
        z = y;
        y = (z + x / z) / 2u256;
    }
    z
}

impl BondingCurve {
    pub fn new(max_supply: u64) -> Self {
        Self { sold_supply: 0, max_supply, base_price: 0, slope: 0 }
    }

    pub fn initialize(ref mut self, total_pledged: u64, users_share: u64) {
        require(self.max_supply > 0, "Max supply must be greater than 0");
        require(users_share > 0, "Users share must be greater than 0");
        require(total_pledged > 0, "Total pledged must be greater than 0");
        require(users_share <= self.max_supply, "Users share exceeds max supply");

        self.sold_supply = users_share;
        let total_pledged_256 = u256::from(total_pledged);
        let users_share_256 = u256::from(users_share);
        let max_supply_256 = u256::from(self.max_supply);

        let avg_price = (total_pledged_256 * PRICE_SCALE) / users_share_256;
        let slope = (avg_price * SLOPE_SCALE) / max_supply_256;

        let slope_component = (slope * users_share_256 * users_share_256) / (TWO_U256 * SLOPE_SCALE);
        let numerator = total_pledged_256 * PRICE_SCALE - slope_component;
        let base_price = numerator / users_share_256;

        self.slope = u256_to_u64(slope);
        self.base_price = u256_to_u64(base_price);
    }

    pub fn supply(self) -> u64 {
        self.max_supply - self.sold_supply
    }

    pub fn current_price(self) -> u64 {
        let base = u256::from(self.base_price);
        let slope = u256::from(self.slope);
        let supply = u256::from(self.sold_supply);
        let price_scaled = base + (slope * supply) / SLOPE_SCALE;
        u256_to_u64(price_scaled)
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
        let cost_scaled = base * delta + (slope * area) / (TWO_U256 * SLOPE_SCALE);
        let cost = cost_scaled / PRICE_SCALE;
        u256_to_u64(cost)
    }

    /// Max tokens purchasable for `budget` (inverse of buy_cost via quadratic formula).
    pub fn tokens_for_budget(self, budget: u64) -> u64 {
        require(budget > 0, "Budget must be greater than 0");

        let base = u256::from(self.base_price);
        let slope = u256::from(self.slope);
        let s = u256::from(self.sold_supply);
        let budget_256 = u256::from(budget);

        let delta = if slope == 0u256 {
            require(base > 0u256, "Base price must be greater than 0");
            (budget_256 * PRICE_SCALE) / base
        } else {
            let q = base * SLOPE_SCALE + slope * s;
            let disc = q * q + TWO_U256 * slope * budget_256 * PRICE_SCALE * SLOPE_SCALE;
            (sqrt_u256(disc) - q) / slope
        };

        let delta_u64 = u256_to_u64(delta);
        let remaining = self.remaining_supply();
        if delta_u64 > remaining { remaining } else { delta_u64 }
    }

    pub fn sell_payout(self, amount: u64) -> u64 {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= self.sold_supply, "Amount exceeds sold supply");

        let s = u256::from(self.sold_supply);
        let delta = u256::from(amount);
        let base = u256::from(self.base_price);
        let slope = u256::from(self.slope);

        let s_before = s - delta;
        let area = (s * s) - (s_before * s_before);
        let payout_scaled = base * delta + (slope * area) / (TWO_U256 * SLOPE_SCALE);
        let payout = payout_scaled / PRICE_SCALE;
        u256_to_u64(payout)
    }
}
