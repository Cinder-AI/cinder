import type { BigNumberish, BN, Provider } from 'fuels';
import { WalletUnlocked, Wallet, concat, arrayify, sha256 } from 'fuels';
import { launchTestNode } from 'fuels/test-utils';
import { FuelFactory } from '../../src/sway-api/contracts/FuelFactory';
import { CinderFactory } from '../../src/sway-api/contracts/CinderFactory';
import { LaunchpadFactory } from '../../src/sway-api/contracts/LaunchpadFactory';
import { Fuel } from '../../src/sway-api/contracts/Fuel';
import { Cinder } from '../../src/sway-api/contracts/Cinder';
import { Launchpad } from '../../src/sway-api/contracts/Launchpad';
import { FuelHelper } from '../helpers/FuelHelper';
import { CinderHelper } from '../helpers/CinderHelper';
import { LaunchpadHelper } from '../helpers/LaunchpadHelper';
import { 
  TestEnvironmentConfig, 
  DEFAULT_TEST_CONFIG,
} from '../fixtures/testFixtures';

/**
 * Default sub ID for token minting
 */
const DEFAULT_SUB_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Contract set containing all deployed contracts
 */
export interface ContractSet {
  fuel: FuelHelper;
  cinder: CinderHelper;
  launchpad: LaunchpadHelper;
}

/**
 * Asset IDs for the test environment
 */
export interface AssetIds {
  fuel: string;
  cinder: string;
  base: string;
}

/**
 * Test environment that manages contract deployment and wallet setup
 */
export class TestEnvironment {
  private cleanupFns: Array<() => void | Promise<void>> = [];
  
  public readonly provider: Provider;
  public readonly wallets: WalletUnlocked[];
  public readonly contracts: ContractSet;
  public readonly assetIds: AssetIds;

  private constructor(
    provider: Provider,
    wallets: WalletUnlocked[],
    contracts: ContractSet,
    assetIds: AssetIds
  ) {
    this.provider = provider;
    this.wallets = wallets;
    this.contracts = contracts;
    this.assetIds = assetIds;
  }

  /**
   * Create a new test environment with deployed contracts and funded wallets
   */
  static async create(
    config: Partial<TestEnvironmentConfig> = {}
  ): Promise<TestEnvironment> {
    const fullConfig = { ...DEFAULT_TEST_CONFIG, ...config };
    
    // Launch test node with wallets
    const { cleanup, wallets, provider } = await launchTestNode({
      walletsConfig: {
        count: fullConfig.walletCount,
        coinsPerAsset: 1,
        amountPerCoin: BigInt(fullConfig.baseAssetAmount?.toString() ?? '1000000000000'),
      },
    });

    const creator = wallets[0];

    // Deploy contracts in order
    const { fuel, cinder, launchpad, assetIds } = await TestEnvironment.deployContracts(creator);

    // Create helpers
    const contractSet: ContractSet = {
      fuel: new FuelHelper(fuel),
      cinder: new CinderHelper(cinder),
      launchpad: new LaunchpadHelper(launchpad),
    };

    // Fund wallets with FUEL and CIN tokens
    const env = new TestEnvironment(provider, wallets, contractSet, assetIds);
    await env.fundWallets(fullConfig);

    // Register cleanup
    env.cleanupFns.push(cleanup);

    return env;
  }

  /**
   * Deploy all contracts in the correct order
   */
  private static async deployContracts(creator: WalletUnlocked): Promise<{
    fuel: Fuel;
    cinder: Cinder;
    launchpad: Launchpad;
    assetIds: AssetIds;
  }> {
    // 1. Deploy Fuel contract
    const { waitForResult: fuelDeployResult } = await FuelFactory.deploy(creator);
    const { contract: fuel } = await fuelDeployResult();
    console.log(`Fuel deployed: ${fuel.id.toB256()}`);

    // Initialize Fuel
    const fuelContract = new Fuel(fuel.id, creator);
    const { waitForResult: fuelInitResult } = await fuelContract
      .functions
      .initialize({ Address: { bits: creator.address.toB256() } })
      .call();
    await fuelInitResult();
    console.log('Fuel initialized');

    // Calculate FUEL asset ID
    const fuelAssetId = toAssetIdString(fuel.id.toB256());

    // 2. Deploy Cinder contract
    const { waitForResult: cinderDeployResult } = await CinderFactory.deploy(creator);
    const { contract: cinder } = await cinderDeployResult();
    console.log(`Cinder deployed: ${cinder.id.toB256()}`);

    // 3. Deploy Launchpad contract with configurables
    const cinderContractId = cinder.id.toB256();
    const cinderAssetId = toAssetIdString(cinderContractId);
    const { waitForResult: launchpadDeployResult } = await LaunchpadFactory.deploy(creator, {
      configurableConstants: {
        PLEDGE_ASSET_ID: fuelAssetId,
        CINDER_CONTRACT_ID: cinderContractId,
      },
    });
    const { contract: launchpad } = await launchpadDeployResult();
    console.log(`Launchpad deployed: ${launchpad.id.toB256()}`);

    // Initialize Launchpad
    const launchpadContract = new Launchpad(launchpad.id, creator);
    const { waitForResult: launchpadInitResult } = await launchpadContract
      .functions
      .initialize({ Address: { bits: creator.address.toB256() } })
      .call();
    await launchpadInitResult();
    console.log('Launchpad initialized');

    // Initialize Cinder with Launchpad as owner
    const cinderContract = new Cinder(cinder.id, creator);
    const { waitForResult: cinderInitResult } = await cinderContract
      .functions
      .initialize({ ContractId: { bits: launchpad.id.toB256() } })
      .call();
    await cinderInitResult();
    console.log('Cinder initialized');

    return {
      fuel: fuelContract,
      cinder: cinderContract,
      launchpad: launchpadContract,
      assetIds: {
        fuel: fuelAssetId,
        cinder: cinderAssetId,
        base: '0x0000000000000000000000000000000000000000000000000000000000000000', // Native asset
      },
    };
  }

  /**
   * Fund all wallets with FUEL and CIN tokens
   */
  private async fundWallets(config: TestEnvironmentConfig): Promise<void> {
    const creator = this.wallets[0];

    // Mint FUEL tokens to all wallets
    for (const wallet of this.wallets) {
      await this.contracts.fuel.mint(
        creator,
        wallet.address.toB256(),
        config.fuelAmount ?? DEFAULT_TEST_CONFIG.fuelAmount!
      );
    }
    console.log('FUEL tokens minted to all wallets');

    // Mint CIN tokens to all wallets
    for (const wallet of this.wallets) {
      await this.contracts.launchpad.mintCinder(
        creator,
        wallet.address.toB256(),
        config.cinAmount ?? DEFAULT_TEST_CONFIG.cinAmount!
      );
    }
    console.log('CIN tokens minted to all wallets');
  }

  /**
   * Get a wallet by index
   */
  getWallet(index: number): WalletUnlocked {
    return this.wallets[index];
  }

  /**
   * Get the creator wallet (first wallet)
   */
  getCreator(): WalletUnlocked {
    return this.wallets[0];
  }

  /**
   * Get user wallets (all wallets except creator)
   */
  getUsers(): WalletUnlocked[] {
    return this.wallets.slice(1);
  }

  /**
   * Cleanup test environment
   */
  async cleanup(): Promise<void> {
    for (const cleanup of this.cleanupFns) {
      await cleanup();
    }
    this.cleanupFns = [];
  }
}

/**
 * Convert contract ID and sub ID to asset ID string
 */
function toAssetIdString(contractId: string, subId: string = DEFAULT_SUB_ID): string {
  const bytes = concat([arrayify(contractId), arrayify(subId)]);
  return sha256(bytes);
}
