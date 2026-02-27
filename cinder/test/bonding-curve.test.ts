import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { BigNumberish, BN } from 'fuels';
import { TestEnvironment } from './setup/TestEnvironment';
import type { TestEnvironmentConfig } from './fixtures/testFixtures';
import { TEST_CONSTANTS } from './fixtures/testFixtures';
import type { LaunchpadHelper } from './helpers';

/**
 * Bonding Curve Trading Tests
 * 
 * These tests verify the bonding curve trading functionality:
 * - Buy tokens from curve increases price
 * - Sell tokens to curve decreases price
 */

describe('Bonding Curve Trading', () => {
  let env: TestEnvironment;
  let launchpad: LaunchpadHelper;

  const config: Partial<TestEnvironmentConfig> = {
    walletCount: 5,
    fuelAmount: TEST_CONSTANTS.DEFAULT_FUEL_AMOUNT,
    cinAmount: TEST_CONSTANTS.DEFAULT_CIN_AMOUNT,
    baseAssetAmount: TEST_CONSTANTS.DEFAULT_BASE_ASSET_AMOUNT,
  };

  beforeEach(async () => {
    env = await TestEnvironment.create(config);
    launchpad = env.contracts.launchpad;
  }, 60000);

  // Use rotating creators for tests that create campaigns
  let _nextCreatorIndex = 0;
  const getNextCreator = () => {
    const users = env.getUsers();
    const idx = _nextCreatorIndex % users.length;
    _nextCreatorIndex += 1;
    return users[idx];
  };

  afterEach(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  describe('Price Dynamics', () => {
    test('should increase price after buying tokens from curve', async () => {
      // Step 1: Create campaign without boost
      const creator = getNextCreator();
      const tokenId = await launchpad.createCampaign(creator, {
        name: 'Bonding Test Token',
        ticker: 'BTT',
        description: 'Testing bonding curve price dynamics',
        image: 'https://test.com/btt.png',
      });

      // Verify campaign is active
      const campaignBefore = await launchpad.getCampaign(tokenId);
      expect(campaignBefore.status).toBe('Active');
      expect(campaignBefore.curve.soldSupply.toNumber()).toBe(0);

      // Step 2: Have users pledge from different wallets using BASE asset (native)
      // This ensures wallets retain native ETH for buying
      const otherUsers = env.getUsers().filter(
        u => u.address.toB256() !== creator.address.toB256()
      );
      
      // Use 3 users for pledges
      const pledger1 = otherUsers[0];
      const pledger2 = otherUsers[1];
      const pledger3 = otherUsers[2];

      // Use smaller pledge amounts to leave enough native ETH for buying
      const pledgeAmount1: BigNumberish = 100;
      const pledgeAmount2: BigNumberish = 150;
      const pledgeAmount3: BigNumberish = 200;

      // Pledge using base asset (native ETH) - this is what wallets have from test node
      await launchpad.pledge(pledger1, tokenId, pledgeAmount1, env.assetIds.base);
      await launchpad.pledge(pledger2, tokenId, pledgeAmount2, env.assetIds.base);
      await launchpad.pledge(pledger3, tokenId, pledgeAmount3, env.assetIds.base);

      // Step 3: Launch campaign
      await launchpad.launchCampaign(env.getCreator(), tokenId);

      // Verify campaign is launched
      const launchedCampaign = await launchpad.getCampaign(tokenId);
      expect(launchedCampaign.status).toBe('Launched');
      
      // Curve should now be initialized - soldSupply should be > 0
      expect(launchedCampaign.curve.soldSupply.toNumber()).toBeGreaterThan(0);
      expect(launchedCampaign.curve.k.toNumber()).toBeGreaterThan(0);

      // Step 4: Users claim their tokens
      await launchpad.claim(pledger1, tokenId);
      await launchpad.claim(pledger2, tokenId);
      await launchpad.claim(pledger3, tokenId);

      // Get initial curve state
      const campaignBeforeBuy = await launchpad.getCampaign(tokenId);
      const soldSupplyBefore = campaignBeforeBuy.curve.soldSupply.toNumber();

      // Step 5: User buys tokens from the curve using base asset
      const buyBudget: BigNumberish = 50;
      const buyer = pledger1;
      
      const cost = await launchpad.buy(
        buyer,
        tokenId,
        buyBudget,
        env.assetIds.base
      );
      console.debug('Buy cost:', cost.toNumber());

      // Step 6: Verify price increased after buy
      const campaignAfterBuy = await launchpad.getCampaign(tokenId);
      
      // Price should increase - sold supply should be greater
      expect(campaignAfterBuy.curve.soldSupply.toNumber()).toBeGreaterThan(soldSupplyBefore);
      
      // Base price stays the same
      expect(campaignAfterBuy.curve.k.toNumber()).toBe(campaignBeforeBuy.curve.k.toNumber());
    });

    test('should decrease price after selling tokens back to curve', async () => {
      // Step 1: Create campaign without boost
      const creator = getNextCreator();
      const tokenId = await launchpad.createCampaign(creator, {
        name: 'Bonding Sell Test',
        ticker: 'BST',
        description: 'Testing sell price dynamics',
        image: 'https://test.com/bst.png',
      });

      // Step 2: Have users pledge using base asset
      const otherUsers = env.getUsers().filter(
        u => u.address.toB256() !== creator.address.toB256()
      );
      
      const pledger1 = otherUsers[0];
      const pledger2 = otherUsers[1];

      const pledgeAmount1: BigNumberish = 100;
      const pledgeAmount2: BigNumberish = 100;

      await launchpad.pledge(pledger1, tokenId, pledgeAmount1, env.assetIds.base);
      await launchpad.pledge(pledger2, tokenId, pledgeAmount2, env.assetIds.base);

      // Step 3: Launch campaign
      await launchpad.launchCampaign(env.getCreator(), tokenId);

      // Step 4: Users claim their tokens
      await launchpad.claim(pledger1, tokenId);
      await launchpad.claim(pledger2, tokenId);

      // Step 5: First, buy some tokens to have tokens to sell
      const buyBudget: BigNumberish = 30;
      await launchpad.buy(pledger1, tokenId, buyBudget, env.assetIds.base);

      // Get sold supply after buy
      const campaignAfterBuy = await launchpad.getCampaign(tokenId);
      const soldSupplyAfterBuy = campaignAfterBuy.curve.soldSupply.toNumber();

      // Get token balance of buyer before selling
      const tokensBeforeSell = await pledger1.getBalance(tokenId);
      console.debug('Tokens before sell:', tokensBeforeSell?.toString());

      // Step 6: Sell tokens back to the curve
      // Sell some tokens
      const tokensToSell = tokensBeforeSell ? tokensBeforeSell.div(2) : undefined;
      expect(tokensToSell).toBeDefined();
      expect(tokensToSell!.toNumber()).toBeGreaterThan(0);

      const payout = await launchpad.sell(pledger1, tokenId, tokensToSell!.toString());
      console.debug('Sell payout:', payout.toNumber());

      // Step 7: Verify price decreased after sell
      const campaignAfterSell = await launchpad.getCampaign(tokenId);
      const soldSupplyAfterSell = campaignAfterSell.curve.soldSupply.toNumber();
      
      // Price should decrease - sold supply should be less after sell
      expect(soldSupplyAfterSell).toBeLessThan(soldSupplyAfterBuy);
    });

    test('should have correct buy cost calculation', async () => {
      // Create campaign and setup
      const creator = getNextCreator();
      const tokenId = await launchpad.createCampaign(creator, {
        name: 'Cost Calc Test',
        ticker: 'CCT',
        description: 'Testing cost calculation',
        image: 'https://test.com/cct.png',
      });

      const otherUsers = env.getUsers().filter(
        u => u.address.toB256() !== creator.address.toB256()
      );
      const pledger = otherUsers[0];

      const pledgeAmount: BigNumberish = 100;
      await launchpad.pledge(pledger, tokenId, pledgeAmount, env.assetIds.base);

      await launchpad.launchCampaign(env.getCreator(), tokenId);
      await launchpad.claim(pledger, tokenId);

      // Get curve data before buy
      const campaignBefore = await launchpad.getCampaign(tokenId);
      const soldSupplyBefore = campaignBefore.curve.soldSupply.toNumber();
      
      // Buy tokens
      const buyBudget: BigNumberish = 10;
      const actualCost = await launchpad.buy(
        pledger,
        tokenId,
        buyBudget,
        env.assetIds.base
      );
      console.debug('Actual cost:', actualCost.toNumber());

      // Cost should be > 0 and <= budget
      expect(actualCost.toNumber()).toBeGreaterThan(0);
      expect(actualCost.toNumber()).toBeLessThanOrEqual(Number(buyBudget));
      
      // Verify sold supply increased
      const campaignAfter = await launchpad.getCampaign(tokenId);
      expect(campaignAfter.curve.soldSupply.toNumber()).toBeGreaterThan(soldSupplyBefore);
    });

    test('should have correct sell payout calculation', async () => {
      // Create campaign and setup
      const creator = getNextCreator();
      const tokenId = await launchpad.createCampaign(creator, {
        name: 'Payout Calc Test',
        ticker: 'PCT',
        description: 'Testing payout calculation',
        image: 'https://test.com/pct.png',
      });

      const otherUsers = env.getUsers().filter(
        u => u.address.toB256() !== creator.address.toB256()
      );
      const pledger = otherUsers[0];

      const pledgeAmount: BigNumberish = 100;
      await launchpad.pledge(pledger, tokenId, pledgeAmount, env.assetIds.base);

      await launchpad.launchCampaign(env.getCreator(), tokenId);
      await launchpad.claim(pledger, tokenId);

      // Buy some tokens first
      await launchpad.buy(pledger, tokenId, 20, env.assetIds.base);

      // Get curve data after buy
      const campaignAfterBuy = await launchpad.getCampaign(tokenId);
      const soldSupplyBeforeSell = campaignAfterBuy.curve.soldSupply.toNumber();
      const curveReserveBeforeSell = campaignAfterBuy.curveReserve.toNumber();

      // Get tokens to sell
      const tokensToSell = await pledger.getBalance(tokenId);
      expect(tokensToSell).toBeDefined();
      expect(tokensToSell.toNumber()).toBeGreaterThan(0);

      // Sell tokens
      const sellAmount = tokensToSell.div(2);
      const actualPayout = await launchpad.sell(pledger, tokenId, sellAmount.toString());
      console.debug('Actual payout:', actualPayout.toNumber());

      // Verify payout is > 0
      expect(actualPayout.toNumber()).toBeGreaterThan(0);
      
      // Verify sold supply decreased
      const campaignAfterSell = await launchpad.getCampaign(tokenId);
      expect(campaignAfterSell.curve.soldSupply.toNumber()).toBeLessThan(soldSupplyBeforeSell);
      
      // Verify curve reserve decreased
      expect(campaignAfterSell.curveReserve.toNumber()).toBeLessThan(curveReserveBeforeSell);
    });
  });

  describe('Curve State', () => {
    test('should initialize curve correctly on launch', async () => {
      const creator = getNextCreator();
      const tokenId = await launchpad.createCampaign(creator, {
        name: 'Curve Init Test',
        ticker: 'CIT',
        description: 'Testing curve initialization',
        image: 'https://test.com/cit.png',
      });

      const otherUsers = env.getUsers().filter(
        u => u.address.toB256() !== creator.address.toB256()
      );
      const pledger = otherUsers[0];

      const pledgeAmount: BigNumberish = 100;
      await launchpad.pledge(pledger, tokenId, pledgeAmount, env.assetIds.base);

      // Launch campaign
      await launchpad.launchCampaign(env.getCreator(), tokenId);

      // Get campaign after launch
      const campaign = await launchpad.getCampaign(tokenId);

      // Verify curve is initialized
      expect(campaign.curve.maxSupply.toNumber()).toBeGreaterThan(0);
      expect(campaign.curve.soldSupply.toNumber()).toBeGreaterThan(0);
      expect(campaign.curve.k.toNumber()).toBeGreaterThan(0);
      expect(campaign.curve.n.toNumber()).toBeGreaterThan(0);

      // Verify curve reserve matches total pledged
      expect(campaign.curveReserve.toNumber()).toBe(campaign.totalPledged.toNumber());
    });

    test('should track sold supply correctly through trades', async () => {
      const creator = getNextCreator();
      const tokenId = await launchpad.createCampaign(creator, {
        name: 'Supply Track Test',
        ticker: 'STT',
        description: 'Testing supply tracking',
        image: 'https://test.com/stt.png',
      });

      const otherUsers = env.getUsers().filter(
        u => u.address.toB256() !== creator.address.toB256()
      );
      const pledger1 = otherUsers[0];
      const pledger2 = otherUsers[1];

      await launchpad.pledge(pledger1, tokenId, 100, env.assetIds.base);
      await launchpad.pledge(pledger2, tokenId, 100, env.assetIds.base);

      await launchpad.launchCampaign(env.getCreator(), tokenId);
      await launchpad.claim(pledger1, tokenId);
      await launchpad.claim(pledger2, tokenId);

      // Get initial sold supply
      const campaign0 = await launchpad.getCampaign(tokenId);
      const initialSupply = campaign0.curve.soldSupply.toNumber();

      // Buy tokens
      await launchpad.buy(pledger1, tokenId, 20, env.assetIds.base);
      
      const campaign1 = await launchpad.getCampaign(tokenId);
      expect(campaign1.curve.soldSupply.toNumber()).toBeGreaterThan(initialSupply);

      // Sell some tokens back
      const tokensToSell = await pledger1.getBalance(tokenId);
      if (tokensToSell && tokensToSell.toNumber() > 1) {
        const sellAmount = tokensToSell.div(2);
        await launchpad.sell(pledger1, tokenId, sellAmount.toString());
        
        const campaign2 = await launchpad.getCampaign(tokenId);
        expect(campaign2.curve.soldSupply.toNumber()).toBeLessThan(campaign1.curve.soldSupply.toNumber());
      }
    });
  });
});
