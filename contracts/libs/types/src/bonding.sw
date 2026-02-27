library;

use utils::*;

pub struct BondingCurve {
    pub max_supply: u64,
    pub supply: u64,
    pub reserve: u64,
    pub sold_supply: u64,
    pub virtual_base_reserve: u64,
    pub virtual_token_reserve: u64,
    pub invariant_k: u256,
}

fn ceil_div_u256(numerator: u256, denominator: u256) -> u256 {
    require(denominator > 0, "Division by zero");
    (numerator + denominator - 1) / denominator
}

impl BondingCurve {
    fn require_initialized(self) {
        require(self.max_supply > 0, "Curve not initialized");
        require(self.supply > 0, "Curve not initialized");
        require(self.virtual_base_reserve > 0, "Curve not initialized");
        require(self.virtual_token_reserve > 0, "Curve not initialized");
        require(self.invariant_k > 0, "Curve not initialized");
    }

    pub fn new(max_supply: u64) -> Self {
        Self {
            supply: 0,
            reserve: 0,
            sold_supply: 0,
            max_supply,
            virtual_base_reserve: 0,
            virtual_token_reserve: 0,
            invariant_k: 0u256,
        }
    }

    pub fn initialize(
        ref mut self,
        virtual_base_reserve: u64,
        virtual_token_reserve: u64,
        max_supply: u64
    ) {
        require(max_supply > 0, "Invalid max supply");
        require(virtual_base_reserve > 0, "Invalid virtual base reserve");
        require(virtual_token_reserve > max_supply, "Invalid virtual token reserve");

        self.virtual_base_reserve = virtual_base_reserve;
        self.virtual_token_reserve = virtual_token_reserve;
        self.invariant_k = u256::from(virtual_base_reserve) * u256::from(virtual_token_reserve);
        self.max_supply = max_supply;
        self.supply = max_supply;
        self.reserve = 0;
        self.sold_supply = 0;
    }

    pub fn is_filled(self) -> bool {
        self.sold_supply >= self.max_supply
    }

    pub fn current_price(self) -> u64 {
        self.require_initialized();
        let price =
            (u256::from(self.virtual_base_reserve) * u256::from(1_000_000_000u64))
            / u256::from(self.virtual_token_reserve);
        u256_to_u64(price)
    }

    pub fn buy_cost(self, amount: u64) -> u64 {
        self.require_initialized();
        require(amount > 0, "Invalid amount");
        require(amount <= self.supply, "Exceeds supply");

        let token_after = self.virtual_token_reserve - amount;
        let base_after = ceil_div_u256(self.invariant_k, u256::from(token_after));
        let cost = base_after - u256::from(self.virtual_base_reserve);
        u256_to_u64(cost)
    }

    pub fn sell_payout(self, amount: u64) -> u64 {
        self.require_initialized();
        require(amount > 0, "Invalid amount");
        require(amount <= self.sold_supply, "Exceeds sold supply");

        let token_after = self.virtual_token_reserve + amount;
        let base_after = self.invariant_k / u256::from(token_after);
        let payout = u256::from(self.virtual_base_reserve) - base_after;
        u256_to_u64(payout)
    }

    pub fn tokens_for_budget(self, budget: u64) -> u64 {
        self.require_initialized();

        if budget == 0 || self.is_filled() {
            return 0;
        }

        let mut low = 1u64;
        let mut high = self.supply;
        let mut best = 0u64;

        while low <= high {
            let mid = low + (high - low) / 2;
            let cost = self.buy_cost(mid);

            if cost <= budget {
                best = mid;
                low = mid + 1;
            } else {
                if mid == 1 {
                    break;
                }
                high = mid - 1;
            }
        }

        best
    }

    pub fn buy(ref mut self, amount: u64) -> u64 {
        self.require_initialized();
        require(!self.is_filled(), "Curve filled");
        require(amount > 0, "Invalid amount");
        require(amount <= self.supply, "Exceeds supply");

        let token_after = self.virtual_token_reserve - amount;
        let base_after = ceil_div_u256(self.invariant_k, u256::from(token_after));
        let cost = base_after - u256::from(self.virtual_base_reserve);

        self.virtual_base_reserve = u256_to_u64(base_after);
        self.virtual_token_reserve = token_after;
        self.sold_supply += amount;
        self.supply -= amount;

        u256_to_u64(cost)
    }

    pub fn sell(ref mut self, amount: u64) -> u64 {
        self.require_initialized();
        require(amount > 0, "Invalid amount");
        require(amount <= self.sold_supply, "Exceeds sold supply");

        let token_after = self.virtual_token_reserve + amount;
        let base_after = self.invariant_k / u256::from(token_after);
        let payout = u256::from(self.virtual_base_reserve) - base_after;

        self.virtual_base_reserve = u256_to_u64(base_after);
        self.virtual_token_reserve = token_after;
        self.sold_supply -= amount;

        u256_to_u64(payout)
    }

    pub fn calc_virtual_reserves(curve_supply: u64, amm_supply: u64, target: u64) -> (u64, u64) {
        let s = u256::from(curve_supply);
        let a = u256::from(amm_supply);
        require(s > a, "Invalid curve/amm split");

        // y0 = S^2 / (S - A)
        let y0 = (s * s) / (s - a);
        require(y0 > s, "Invalid virtual token reserve");

        // x0 = target * (y0 - S) / S
        let x0 = (u256::from(target) * (y0 - s)) / s;
        require(x0 > 0, "Invalid virtual base reserve");

        (u256_to_u64(x0), u256_to_u64(y0))
    }
}

fn test_curve() -> BondingCurve {
    let mut curve = BondingCurve::new(800_000);
    curve.initialize(
        333_333,
        1_066_666,
        800_000,
    );
    curve
}

#[test]
fn initialize_sets_invariant_and_supply() {
    let curve = test_curve();
    assert_eq(curve.sold_supply, 0);
    assert_eq(curve.max_supply, 800_000);
    assert_eq(curve.invariant_k, u256::from(333_333u64) * u256::from(1_066_666u64));
    assert_eq(curve.supply, 800_000);
}

#[test]
fn buy_cost_is_increasing_with_amount() {
    let curve = test_curve();
    let c1 = curve.buy_cost(1_000);
    let c2 = curve.buy_cost(2_000);
    let c3 = curve.buy_cost(3_000);

    assert(c1 > 0);
    assert(c2 > c1);
    assert(c3 > c2);
}

#[test]
fn tokens_for_budget_is_capped_by_remaining_supply() {
    let curve = test_curve();
    let best = curve.tokens_for_budget(u64::max());
    assert_eq(best, curve.supply);
}

#[test]
fn fill_curve_reaches_zero_remaining() {
    let mut curve = test_curve();
    let budget = u64::max();
    let best = curve.tokens_for_budget(budget);
    assert_eq(best, curve.supply);

    let _ = curve.buy(best);
    assert(curve.is_filled());
    assert_eq(curve.supply, 0);
}

#[test]
fn buy_then_sell_updates_supply_and_reserves() {
    let mut curve = test_curve();
    let amount = 25_000;
    let cost = curve.buy_cost(amount);
    let _ = curve.buy(amount);

    assert_eq(curve.sold_supply, amount);
    assert_eq(curve.supply, 800_000 - amount);

    let payout = curve.sell_payout(amount);
    assert(payout > 0);
    assert(payout <= cost);

    let _ = curve.sell(amount);
    assert_eq(curve.sold_supply, 0);
    assert_eq(curve.supply, 800_000);
}