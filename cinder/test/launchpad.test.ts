import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { BigNumberish } from 'fuels';
import { TestEnvironment } from './setup/TestEnvironment';
import type { TestEnvironmentConfig } from './fixtures/testFixtures';
import { TEST_CONSTANTS, DEFAULT_TOKEN_PARAMS } from './fixtures/testFixtures';
import type { CinderHelper, LaunchpadHelper } from './helpers';

/**
 * Launchpad Contract Tests
 * 
 * These tests verify the functionality of the Launchpad contract
 * using the fuels-ts testing framework.
 */

describe('Launchpad Contract', () => {
  let env: TestEnvironment;
  let launchpad: LaunchpadHelper;
  let cinder: CinderHelper;

  const config: Partial<TestEnvironmentConfig> = {
    walletCount: 5,
    fuelAmount: TEST_CONSTANTS.DEFAULT_FUEL_AMOUNT,
    cinAmount: TEST_CONSTANTS.DEFAULT_CIN_AMOUNT,
    baseAssetAmount: TEST_CONSTANTS.DEFAULT_BASE_ASSET_AMOUNT,
  };

  beforeEach(async () => {
    env = await TestEnvironment.create(config);
    launchpad = env.contracts.launchpad;
    cinder = env.contracts.cinder;
  }, 60000); // 60 second timeout for setup

  // Use rotating creators for tests that create campaigns so a single creator
  // doesn't end up with multiple active campaigns (contract enforces one active campaign per creator).
  let _nextCreatorIndex = 0;
  const getNextCreator = () => {
    const users = env.getUsers();
    const idx = _nextCreatorIndex % users.length;
    _nextCreatorIndex += 1;
    return users[idx];
  };

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Environment Setup', () => {
    test('should have deployed all contracts', () => {
      expect(env.contracts.fuel).toBeDefined();
      expect(env.contracts.cinder).toBeDefined();
      expect(env.contracts.launchpad).toBeDefined();
    });

    test('should have correct asset IDs', () => {
      expect(env.assetIds.fuel).toBeDefined();
      expect(env.assetIds.cinder).toBeDefined();
      expect(env.assetIds.base).toBeDefined();
    });

    test('should have funded wallets', () => {
      expect(env.wallets.length).toBe(5);
      expect(env.getCreator()).toBeDefined();
      expect(env.getUsers().length).toBe(4);
    });
  });

  // describe('cinder burn', () => {
  //   test('should burn CIN tokens for boost', async () => {
  //     const creator = getNextCreator();
  //     const cinder = env.contracts.cinder;
  //     const balances = creator.getBalances()[env.assetIds.cinder];
  //     console.debug('balances', balances);
  //     const balance = await creator.getBalance(env.assetIds.cinder);
  //     console.debug('balance', balance.toNumber());


  //     await cinder.burnCinder(creator, env.assetIds.cinder, 100_000_000_000);
  //   })
  // })

  // describe('Campaign Creation', () => {
  //   test('should create a new campaign', async () => {
  //     const creator = getNextCreator();
      
  //     const tokenId = await launchpad.createCampaign(creator, {
  //       name: DEFAULT_TOKEN_PARAMS.name,
  //       ticker: DEFAULT_TOKEN_PARAMS.ticker,
  //       description: DEFAULT_TOKEN_PARAMS.description,
  //       image: DEFAULT_TOKEN_PARAMS.image,
  //     });

  //     expect(tokenId).toBeDefined();
  //     expect(tokenId).toMatch(/^0x/);

  //     // Verify campaign was created
  //     const campaign = await launchpad.getCampaign(tokenId);
  //     expect(campaign).toBeDefined();
  //     expect(campaign.status).toBe('Active');
  //   });

  //   test('should increment campaign counter after creation', async () => {
  //     const counterBefore = await launchpad.getCampaignCounter();
      
  //     const creator = getNextCreator();
  //     await launchpad.createCampaign(creator, {
  //       name: 'Counter Test Token',
  //       ticker: 'CTT',
  //       description: 'Testing counter increment',
  //       image: 'https://test.com/ctt.png',
  //     });

  //     const counterAfter = await launchpad.getCampaignCounter();
  //     expect(counterAfter.toNumber()).toBeGreaterThan(counterBefore.toNumber());
  //   });

  //   test('should store correct token info', async () => {
  //     const creator = getNextCreator();
  //     const tokenName = 'Info Test Token';
  //     const tokenTicker = 'ITT';
  //     const tokenDesc = 'Testing token info storage';
  //     const tokenImage = 'https://test.com/itt.png';

  //     const tokenId = await launchpad.createCampaign(creator, {
  //       name: tokenName,
  //       ticker: tokenTicker,
  //       description: tokenDesc,
  //       image: tokenImage,
  //     });

  //     const tokenInfo = await launchpad.getTokenInfo(tokenId);
  //     expect(tokenInfo.name).toBe(tokenName);
  //     expect(tokenInfo.ticker).toBe(tokenTicker);
  //     expect(tokenInfo.description).toBe(tokenDesc);
  //     expect(tokenInfo.image).toBe(tokenImage);
  //   });
  // });

  // describe('Pledging', () => {
  //   test('should allow user to pledge to a campaign', async () => {
  //     // Create campaign from creator
  //     const creator = getNextCreator();
  //     const tokenId = await launchpad.createCampaign(creator, {
  //       name: 'Pledge Test Token',
  //       ticker: 'PTT',
  //       description: 'Testing pledges',
  //       image: 'https://test.com/ptt.png',
  //     });

  //     // User pledges (must not be the campaign creator)
  //     const user = env.getUsers().find(u => u.address.toB256() !== creator.address.toB256()) || env.getUsers()[0];
  //     const pledgeAmount: BigNumberish = 1000;

  //     await launchpad.pledge(user, tokenId, pledgeAmount, env.assetIds.fuel);

  //     // Verify pledge was recorded
  //     const pledge = await launchpad.getPledge(tokenId, user.address.toB256());
  //     expect(pledge.toNumber()).toBe(Number(pledgeAmount));
  //   });

  //   test('should update total pledged after pledge', async () => {
  //     const creator = getNextCreator();
  //     const tokenId = await launchpad.createCampaign(creator, {
  //       name: 'Total Pledge Test',
  //       ticker: 'TPT',
  //       description: 'Testing total pledged',
  //       image: 'https://test.com/tpt.png',
  //     });

  //     const otherUsers = env.getUsers().filter(u => u.address.toB256() !== creator.address.toB256());
  //     const user1 = otherUsers[0];
  //     const user2 = otherUsers[1];
  //     const pledgeAmount1: BigNumberish = 1000;
  //     const pledgeAmount2: BigNumberish = 2000;

  //     await launchpad.pledge(user1, tokenId, pledgeAmount1, env.assetIds.fuel);
  //     await launchpad.pledge(user2, tokenId, pledgeAmount2, env.assetIds.fuel);

  //     const totalPledged = await launchpad.getTotalPledged(tokenId);
  //     expect(totalPledged.toNumber()).toBe(Number(pledgeAmount1) + Number(pledgeAmount2));
  //   });
  // });

  // describe('Campaign Denial', () => {
  //   test('should deny an active campaign', async () => {
  //     const creator = getNextCreator();
  //     const tokenId = await launchpad.createCampaign(creator, {
  //       name: 'Deny Test Token',
  //       ticker: 'DTT',
  //       description: 'Testing denial',
  //       image: 'https://test.com/dtt.png',
  //     });

  //     // Deny campaign (owner-only action)
  //     const result = await launchpad.denyCampaign(env.getCreator(), tokenId);
  //     expect(result).toBe(true);

  //     // Verify campaign status
  //     const campaign = await launchpad.getCampaign(tokenId);
  //     expect(campaign.status).toBe('Denied');
  //   });
  // });

  // describe('Campaign Launch', () => {
  //   test('should launch a campaign with pledges', async () => {
  //     const creator = getNextCreator();
  //     const tokenId = await launchpad.createCampaign(creator, {
  //       name: 'Launch Test Token',
  //       ticker: 'LTT',
  //       description: 'Testing launch',
  //       image: 'https://test.com/ltt.png',
  //     });

  //     // Add pledges (use a user that's not the creator)
  //     const pledger = env.getUsers().find(u => u.address.toB256() !== creator.address.toB256()) || env.getUsers()[0];
  //     await launchpad.pledge(pledger, tokenId, 1000, env.assetIds.fuel);

  //     // Launch campaign (owner-only action)
  //     const result = await launchpad.launchCampaign(env.getCreator(), tokenId);
  //     expect(result).toBe(true);

  //     // Verify campaign status
  //     const campaign = await launchpad.getCampaign(tokenId);
  //     expect(campaign.status).toBe('Launched');
  //   });
  // });

  // describe('Token Claims', () => {
  //   test('should allow user to claim tokens after launch', async () => {
  //     const creator = getNextCreator();
  //     const tokenId = await launchpad.createCampaign(creator, {
  //       name: 'Claim Test Token',
  //       ticker: 'CLT',
  //       description: 'Testing claims',
  //       image: 'https://test.com/clt.png',
  //     });

  //     // User pledges (must not be the campaign creator)
  //     const user = env.getUsers().find(u => u.address.toB256() !== creator.address.toB256()) || env.getUsers()[0];
  //     const pledgeAmount: BigNumberish = 1000;
  //     await launchpad.pledge(user, tokenId, pledgeAmount, env.assetIds.fuel);

  //     // Launch campaign (owner-only action)
  //     await launchpad.launchCampaign(env.getCreator(), tokenId);

  //     // User claims tokens
  //     const result = await launchpad.claim(user, tokenId);
  //     expect(result).toBe(true);
  //   });
  // });

  // describe('Boost Campaign', () => {
  //   test('should boost a campaign with CIN tokens', async () => {
  //     const creator = getNextCreator();
  //     const tokenId = await launchpad.createCampaign(creator, {
  //       name: 'Boost Test Token',
  //       ticker: 'BTT',
  //       description: 'Testing boost',
  //       image: 'https://test.com/btt.png',
  //     });

  //     // Boost campaign (creator must send CIN). Use creator as sender; TestEnvironment mints CIN to wallets.
  //     const boostAmount: BigNumberish = 1000000000;
  //     const boost = await launchpad.boostCampaign(
  //       creator,
  //       tokenId,
  //       boostAmount,
  //       env.assetIds.cinder
  //     );
  //     const { burnAmount, burnedAt, boostMultiplierX1e6, durationSecs, endsAt, status } = boost;
  //     console.debug('Boost result:', {
  //        burnAmount: burnAmount.toNumber(), 
  //        burnedAt, boostMultiplierX1e6: 
  //        boostMultiplierX1e6.toNumber(), 
  //        durationSecs: durationSecs.toNumber(), 
  //        endsAt: endsAt.toString(),
  //         status });

  //     expect(boost).toBeDefined();
  //     expect(boost.burnAmount.toNumber()).toBe(Number(boostAmount));
  //   });
  // });

  // describe('create campaign with boost', () => {
  //   test('should create a boosted campaign with forward boost', async () => {

  //     const totalSupplyBefore = await cinder.totalSupply();
  //     console.debug('totalSupplyBefore', totalSupplyBefore?.toNumber());
  //     const creator = getNextCreator();
  //     const boostAmount: BigNumberish = 300_000_000_000;
  //     const { assetId: tokenId, campaign } = await launchpad.createBoostedCampaign(
  //       creator,
  //       {
  //         name: 'CreateBoost Token',
  //         ticker: 'CBT',
  //         description: 'Campaign created with forward boost',
  //         image: 'https://test.com/cbt.png',
  //       },
  //       env.assetIds.cinder,
  //       boostAmount
  //     );

  //     const totalSupplyAfter = await cinder.totalSupply();
  //     console.debug('totalSupplyAfter', totalSupplyAfter?.toNumber());
  //     console.debug('campaign', campaign);
  //     expect(totalSupplyBefore?.toNumber()).toBeGreaterThan(totalSupplyAfter?.toNumber() ?? 0);

  //     expect(tokenId).toBeDefined();
  //     expect(campaign).toBeDefined();
  //     expect(campaign.boost).toBeDefined();
  //     expect(campaign.boost!.burnAmount.toNumber()).toBeGreaterThan(0);

  //   })
  // });

  describe("create pool and add liquidity", () => {
    test('should create Reactor pool and add liquidity', async () => {
      const creator = getNextCreator();
    })
  });
});