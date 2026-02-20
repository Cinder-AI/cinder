import type { Account, BigNumberish, BN } from 'fuels';
import { Cinder, IdentityInput } from '../../src/sway-api/contracts/Cinder';
import { toAssetIdString } from '../../src/utils';

/**
 * Default sub ID for token minting
 */
export const DEFAULT_SUB_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Helper class for interacting with the Cinder contract
 */
export class CinderHelper {
  public readonly contract: Cinder;
  public readonly id: string;

  constructor(contract: Cinder) {
    this.contract = contract;
    this.id = contract.id.toB256();
  }

  private withSender(sender: Account): Cinder {
    return new Cinder(this.contract.id, sender as any);
  }

  /**
   * Get the asset ID for the CIN token
   */
  getAssetId(): string {
    return toAssetIdString(this.id);
  }

  /**
   * Mint CIN tokens to a recipient
   */
  async mintCinder(
    sender: Account,
    recipient: string,
    amount: BigNumberish
  ): Promise<void> {
    const recipientIdentity: IdentityInput = {
      Address: { bits: recipient },
    };

    const { waitForResult } = await this.contract
      .functions
      .mint_cinder(recipientIdentity, amount)
      .call();

    await waitForResult();
  }

  /**
   * Burn CIN tokens from a sender
   */
  async burnCinder(
    sender: Account,
    cinAssetId: string,
    amount: BigNumberish
  ): Promise<void> {
    const senderIdentity: IdentityInput = {
      Address: { bits: sender.address.toB256() },
    };
    const contract = this.withSender(sender);

    const { waitForResult } = await contract
      .functions
      .burn_cinder(senderIdentity, amount)
      .callParams({ forward: { assetId: cinAssetId, amount: amount as any } })
      .call();

    const { value, logs } =await waitForResult();
    console.debug('Burn result:', { value, logs });
  }

  /**
   * Initialize the Cinder contract with an owner
   */
  async initialize(owner: Account, ownerAddress: string): Promise<void> {
    const ownerIdentity: IdentityInput = {
      ContractId: { bits: ownerAddress },
    };

    const { waitForResult } = await this.contract
      .functions
      .initialize(ownerIdentity)
      .call();

    await waitForResult();
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
   * Get total supply of CIN token
   */
  async totalSupply(): Promise<BN | null> {
    const assetId = this.getAssetId();
    const { value } = await this.contract
      .functions
      .total_supply({ bits: assetId })
      .get();
    return value ?? null;
  }

  /**
   * Get asset info for CIN token
   */
  async assetInfo(): Promise<{
    assetId: string;
    name: string;
    ticker: string;
    description: string;
    decimals: number;
    image: string;
  } | null> {
    const { value } = await this.contract
      .functions
      .asset_info({ bits: this.id })
      .get();
    
    if (value) {
      return {
        assetId: value.asset_id.bits,
        name: value.name,
        ticker: value.ticker,
        description: value.description,
        decimals: value.decimals,
        image: value.image,
      };
    }
    return null;
  }
}
