library;

use std::string::String;
use std::identity::Identity;
use std::block::timestamp;
use utils::*;

const FP_X1E6: u256 = 1_000_000u256;
const LN2_X1E6: u256 = 693_147u256;
const TWO_U256: u256 = 2u256;
const SECONDS_PER_HOUR: u64 = 3600;

// Boost constants
pub const BURN_REF: u64 = 100;
pub const BOOST_MIN_HOURS: u64 = 2;
pub const BOOST_TIME_SCALE_HOURS: u64 = 4;
pub const BOOST_MAX_HOURS: u64 = 24;
pub const CARRYOVER_FACTOR_X1E6: u64 = 800_000; // 0.8

pub enum BoostStatus {
    Active: (),
    Expired: (),
    CarriedOver: (),
}

impl PartialEq for BoostStatus {
    fn eq(self, other: Self) -> bool {
        match (self, other) {
            (BoostStatus::Active, BoostStatus::Active) => true,
            (BoostStatus::Expired, BoostStatus::Expired) => true,
            (BoostStatus::CarriedOver, BoostStatus::CarriedOver) => true,
            _ => false,
        }
    }
}

pub struct Boost {
    pub burn_amount: u64,
    pub burned_at:u64,
    pub boost_power_x1e6: u64,
    pub duration_secs: u64,
    pub ends_at: u64,
    pub status: BoostStatus,
}

fn clamp_u64(value: u64, min_v: u64, max_v: u64) -> u64 {
    if value < min_v {
        min_v
    } else if value > max_v {
        max_v
    } else {
        value
    }
}

// Natural log approximation in fixed-point x1e6 for ln(1 + num/den)
fn ln_lp_ratio_x1e6(num: u64, den: u64) -> u64 {
    require(den > 0, "denominator must be > 0");

    // x = 1 + num/den in x1e6
    let x = FP_X1E6 + (u256::from(num) * FP_X1E6) / u256::from(den);

    // Normalize x = m * 2^k, where m in [1, 2]
    let mut m = x;
    let mut k: u64 = 0;
    while m >= (TWO_U256 * FP_X1E6) {
        m = m / TWO_U256;
        k += 1;
    }

    // ln(m) via atanh-series:
    // ln(m) = 2 * (y + y^3/3 + y^5/5 + y^7/7 + y^9/9)
    // where y = (m - 1) / (m + 1)
    let y = ((m - FP_X1E6) * FP_X1E6) / (m + FP_X1E6);
    let y2 = (y * y) / FP_X1E6;
    let y3 = (y2 * y) / FP_X1E6;
    let y5 = (y3 * y2) / FP_X1E6;
    let y7 = (y5 * y2) / FP_X1E6;
    let y9 = (y7 * y2) / FP_X1E6;

    let series = y + (y3 / 3u256) + (y5 / 5u256) + (y7 / 7u256) + (y9 / 9u256);
    let ln_m = TWO_U256 * series;

    let ln_x = (u256::from(k) * LN2_X1E6) + ln_m;
    u256_to_u64(ln_x)
}

impl Boost {
    // boost power = ln(1 + burn_amount / BURN_REF)
    pub fn calc_boost_power_x1e6(burn_amount: u64) -> u64 {
        ln_lp_ratio_x1e6(burn_amount, BURN_REF)
    }

    //duration = clamp(MIN + SCALE * ln(1 + burn/BURN_REF), MIN, MAX)
    pub fn calc_duration_secs(burn_amount: u64) -> u64 {
        let power_x1e6 = Self::calc_boost_power_x1e6(burn_amount);

        let min_secs = BOOST_MIN_HOURS * SECONDS_PER_HOUR;
        let max_secs = BOOST_MAX_HOURS * SECONDS_PER_HOUR;
        let scale_secs = BOOST_TIME_SCALE_HOURS * SECONDS_PER_HOUR;

        let extra_secs = u256_to_u64(
            (u256::from(scale_secs) * u256::from(power_x1e6)) / FP_X1E6
        );

        clamp_u64(min_secs + extra_secs, min_secs, max_secs)
    }

    pub fn new(
        burn_amount: u64,
        burned_at: u64,
    ) -> Self {
        require(burn_amount > 0, "Burn amount must be greater than 0");

        let boost_power_x1e6 = Self::calc_boost_power_x1e6(burn_amount);
        let duration_secs = Self::calc_duration_secs(burn_amount);
        let ends_at = burned_at + duration_secs;

        Self {
            burn_amount,
            burned_at,
            boost_power_x1e6,
            duration_secs,
            ends_at,
            status: BoostStatus::Active,
        }
    }

    pub fn is_active(self, now_ts: u64) -> bool {
        self.status == BoostStatus::Active && now_ts < self.ends_at
    }

    pub fn refresh_status(ref mut self, now_ts: u64) {
        if self.status == BoostStatus::Active && now_ts >= self.ends_at {
            self.status = BoostStatus::Expired;
        }
    }

    pub fn remaining_ratio_x1e6(self, now_ts: u64) -> u64 {
        if now_ts >= self.ends_at || self.duration_secs == 0 {
            return 0;
        }
        let remaining = self.ends_at - now_ts;
        u256_to_u64((u256::from(remaining) * FP_X1E6) / u256::from(self.duration_secs))
    }

    pub fn carryover_credit(self, now_ts: u64) -> u64 {
        let rr_x1e6 = self.remaining_ratio_x1e6(now_ts);
        let num = u256::from(self.burn_amount) * u256::from(rr_x1e6) * u256::from(CARRYOVER_FACTOR_X1E6);
        let den = FP_X1E6 * FP_X1E6;
        u256_to_u64(num / den)
    }
}

#[test]
fn test_boost_power_x1e6() {
    let boost_power_x1e6 = Boost::calc_boost_power_x1e6(300);
    assert_eq(boost_power_x1e6, 1_386_294);
}

#[test]
fn test_duration_secs() {
    let duration_secs = Boost::calc_duration_secs(300);
    assert_eq(duration_secs, 27_162);
}

#[test]
fn test_remaining_ratio_x1e6() {
    let boost = Boost {
        burn_amount: 300,
        duration_secs: 27_162,
        ends_at: 27_162,
        status: BoostStatus::Active,
        boost_power_x1e6: 1_386_294,
        burned_at: 0,
    };
    let ratio = boost.remaining_ratio_x1e6(13_581);
    assert_eq(ratio, 500_000);
}

#[test]
fn test_carryover_credit() {
    let boost = Boost {
        burn_amount: 300,
        burned_at: 0,
        boost_power_x1e6: 1_386_294, 
        duration_secs: 27_162,
        ends_at: 27_162,
        status: BoostStatus::Active, 
    };

    let credit = boost.carryover_credit(13_581);
    assert_eq(credit, 120);
}