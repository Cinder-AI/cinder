import type { Account, BigNumberish, BN } from 'fuels';
import { 
  Launchpad, 
  IdentityInput, 
  CampaignOutput, 
  TokenInfoOutput,
  BondingCurveOutput,
  BoostOutput,
  CampaignStatusOutput,
  BoostStatusOutput,
} from '../../src/sway-api/contracts/Launchpad';
import type { Option } from '../../src/sway-api/contracts/common';

/**
 * Default sub ID for token minting
 */
export const DEFAULT_SUB_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Campaign creation parameters
 */
export interface CreateCampaignParams {
  name: string;
  ticker: string;
  description: string;
  image: string;
}

/**
 * Campaign data with resolved types
 */
export interface CampaignData {
  target: BN;
  creator: IdentityInput;
  status: CampaignStatusOutput;
  tokenId: string;
  subId: string;
  totalPledged: BN;
  curveReserve: BN;
  totalSupply: BN;
  curve: {
    soldSupply: BN;
    maxSupply: BN;
    basePrice: BN;
    slope: BN;
  };
  ammReserved: BN;
  boost: Option<{
    burnAmount: BN;
    burnedAt: BN;
    boostPowerX1e6: BN;
    durationSecs: BN;
    endsAt: BN;
    status: BoostStatusOutput;
  }>;
}

/**
 * Token info data
 */
export interface TokenInfoData {
  assetId: string;
  name: string;
  ticker: string;
  description: string;
  decimals: number;
  image: string;
}

/**
 * Helper class for interacting with the Launchpad contract
 */
export class LaunchpadHelper {
  public readonly contract: Launchpad;
  public readonly id: string;

  constructor(contract: Launchpad) {
    this.contract = contract;
    this.id = contract.id.toB256();
  }

  private withSender(sender: Account): Launchpad {
    return new Launchpad(this.contract.id, sender as any);
  }

  // ==================== Read Methods ====================

  /**
   * Get campaign by asset ID
   */
  async getCampaign(assetId: string): Promise<CampaignData> {
    const { value } = await this.contract
      .functions
      .get_campaign({ bits: assetId })
      .get();

    return this.mapCampaignOutput(value);
  }

  /**
   * Get campaign counter
   */
  async getCampaignCounter(): Promise<BN> {
    const { value } = await this.contract.functions.get_campaign_counter().get();
    return value;
  }

  /**
   * Get pledge amount for a user and campaign
   */
  async getPledge(assetId: string, senderAddress: string): Promise<BN> {
    const senderIdentity: IdentityInput = {
      Address: { bits: senderAddress },
    };

    const { value } = await this.contract
      .functions
      .get_pledge({ bits: assetId }, senderIdentity)
      .get();

    return value;
  }

  /**
   * Get token info by asset ID
   */
  async getTokenInfo(assetId: string): Promise<TokenInfoData> {
    const { value } = await this.contract
      .functions
      .get_token_info({ bits: assetId })
      .get();

    return {
      assetId: value.asset_id.bits,
      name: value.name,
      ticker: value.ticker,
      description: value.description,
      decimals: value.decimals,
      image: value.image,
    };
  }

  /**
   * Get all assets
   */
  async getAssets(): Promise<TokenInfoData[]> {
    const { value } = await this.contract.functions.get_assets().get();
    return value.map((info) => ({
      assetId: info.asset_id.bits,
      name: info.name,
      ticker: info.ticker,
      description: info.description,
      decimals: info.decimals,
      image: info.image,
    }));
  }

  /**
   * Get total pledged amount for a campaign
   */
  async getTotalPledged(assetId: string): Promise<BN> {
    const { value } = await this.contract
      .functions
      .get_total_pledged({ bits: assetId })
      .get();
    return value;
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(): Promise<CampaignData[]> {
    const { value } = await this.contract.functions.get_campaigns().get();
    return value.map((campaign) => this.mapCampaignOutput(campaign));
  }

  /**
   * Get the owner of the contract
   */
  async owner(): Promise<string | null> {
    const { value } = await this.contract.functions.owner().get();
    if (value.Initialized) {
      return value.Initialized.Address?.bits ?? value.Initialized.ContractId?.bits ?? null;
    }
    return null;
  }

  /**
   * Get creator boost credit
   */
  async getCreatorBoostCredit(creator: string): Promise<BN> {
    const creatorIdentity: IdentityInput = {
      Address: { bits: creator },
    };
    const { value } = await this.contract.functions.get_creator_boost_credit(creatorIdentity).get();
    return value;
  }

  // ==================== Write Methods ====================

  /**
   * Initialize the Launchpad contract with an owner
   */
  async initialize(owner: Account, ownerAddress: string): Promise<void> {
    const ownerIdentity: IdentityInput = {
      Address: { bits: ownerAddress },
    };

    const { waitForResult } = await this.contract
      .functions
      .initialize(ownerIdentity)
      .call();

    await waitForResult();
  }

  /**
   * Create a new campaign
   * @returns The asset ID of the created campaign
   */
  async createCampaign(
    sender: Account,
    params: CreateCampaignParams
  ): Promise<string> {
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .create_campaign(params.name, params.ticker, params.description, params.image)
      .call();

    const { value } = await waitForResult();
    return value.bits;
  }

  /**
   * Create a boosted campaign (with CIN tokens)
   * @returns The asset ID of the created campaign
   */
  async createBoostedCampaign(
    sender: Account,
    params: CreateCampaignParams,
    cinAssetId: string,
    boostAmount: BigNumberish
  ): Promise<{ assetId: string; campaign: CampaignData; logs: any[] }> {
    const contract = this.withSender(sender);

    // create campaign with forwarded CIN tokens
    const { waitForResult: createWait } = await contract
      .functions
      .create_campaign(params.name, params.ticker, params.description, params.image)
      .callParams({
        forward: {
          amount: boostAmount,
          assetId: cinAssetId,
        }
      })
      .call();
    const { value, logs } = await createWait();
    const assetId = value.bits;
    console.debug('[LaunchpadHelper] createBoostedCampaign create result:', { assetId, logs });

    // read stored campaign (should now include boost)
    const campaign = await this.getCampaign(assetId);
    return { assetId, campaign, logs: [] };
  }

  /**
   * Pledge to a campaign
   */
  async pledge(
    sender: Account,
    assetId: string,
    amount: BigNumberish,
    pledgeAssetId: string
  ): Promise<boolean> {
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .pledge({ bits: assetId }, amount)
      .callParams({
        forward: {
          amount,
          assetId: pledgeAssetId,
        },
      })
      .call();

    const { value } = await waitForResult();
    return value;
  }

  /**
   * Claim tokens after campaign launch
   */
  async claim(sender: Account, assetId: string): Promise<boolean> {
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .claim({ bits: assetId })
      .call();

    const { value } = await waitForResult();
    return value;
  }

  /**
   * Launch a campaign
   */
  async launchCampaign(sender: Account, assetId: string): Promise<boolean> {
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .launch_campaign({ bits: assetId })
      .call();

    const { value } = await waitForResult();
    return value;
  }

  /**
   * Deny a campaign
   */
  async denyCampaign(sender: Account, assetId: string): Promise<boolean> {
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .deny_campaign({ bits: assetId })
      .call();

    const { value, logs } = await waitForResult();
    console.debug('[LaunchpadHelper] denyCampaign result:', { value, logs });
    return value;
  }

  /**
   * Buy tokens from bonding curve
   * @returns The cost in base asset
   */
  async buy(
    sender: Account,
    assetId: string,
    amount: BigNumberish,
    baseAssetId: string
  ): Promise<BN> {
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .buy({ bits: assetId })
      .callParams({
        forward: {
          amount,
          assetId: baseAssetId,
        },
      })
      .call();

    const { value } = await waitForResult();
    return value;
  }

  /**
   * Sell tokens back to bonding curve
   * @returns The payout in base asset
   */
  async sell(
    sender: Account,
    assetId: string,
    amount: BigNumberish
  ): Promise<BN> {
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .sell({ bits: assetId })
      .callParams({
        forward: {
          amount,
          assetId,
        },
      })
      .call();

    const { value } = await waitForResult();
    return value;
  }

  /**
   * Boost a campaign by burning CIN tokens
   */
  async boostCampaign(
    sender: Account,
    assetId: string,
    burnAmount: BigNumberish,
    cinAssetId: string
  ): Promise<{
    burnAmount: BN;
    burnedAt: BN;
    boostPowerX1e6: BN;
    durationSecs: BN;
    endsAt: BN;
    status: BoostStatusOutput;
  }> {
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .boost_campaign({ bits: assetId }, burnAmount)
      .callParams({
        forward: {
          amount: burnAmount,
          assetId: cinAssetId,
        },
      })
      .call();

    const { value, logs } = await waitForResult();
    console.debug('[LaunchpadHelper] boostCampaign result:', { value, logs });
    return {
      burnAmount: value.burn_amount,
      burnedAt: value.burned_at,
      boostPowerX1e6: value.boost_power_x1e6,
      durationSecs: value.duration_secs,
      endsAt: value.ends_at,
      status: value.status,
    };
  }

  /**
   * Refund pledge after campaign denial
   */
  async refundPledge(sender: Account, assetId: string): Promise<boolean> {
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .refund_pledge({ bits: assetId })
      .call();

    const { value } = await waitForResult();
    return value;
  }

  /**
   * Mint CIN tokens (if available on Launchpad)
   */
  async mintCinder(
    sender: Account,
    recipient: string,
    amount: BigNumberish
  ): Promise<boolean> {
    const recipientIdentity: IdentityInput = {
      Address: { bits: recipient },
    };
    const contract = this.withSender(sender);
    const { waitForResult } = await contract
      .functions
      .mint_cinder(recipientIdentity, amount)
      .call();

    const { value } = await waitForResult();
    return value;
  }

  // ==================== Helper Methods ====================

  /**
   * Map CampaignOutput to CampaignData
   */
  private mapCampaignOutput(campaign: CampaignOutput): CampaignData {
    return {
      target: campaign.target,
      creator: campaign.creator,
      status: campaign.status,
      tokenId: campaign.token_id.bits,
      subId: campaign.sub_id,
      totalPledged: campaign.total_pledged,
      curveReserve: campaign.curve_reserve,
      totalSupply: campaign.total_supply,
      curve: {
        soldSupply: campaign.curve.sold_supply,
        maxSupply: campaign.curve.max_supply,
        basePrice: campaign.curve.base_price,
        slope: campaign.curve.slope,
      },
      ammReserved: campaign.amm_reserved,
      boost: campaign.boost ? {
        burnAmount: campaign.boost.burn_amount,
        burnedAt: campaign.boost.burned_at,
        boostPowerX1e6: campaign.boost.boost_power_x1e6,
        durationSecs: campaign.boost.duration_secs,
        endsAt: campaign.boost.ends_at,
        status: campaign.boost.status,
      } : undefined,
    };
  }
}
