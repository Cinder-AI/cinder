import type { Account, BigNumberish, BN } from 'fuels';
import { Fuel, IdentityInput } from '../../src/sway-api/contracts/Fuel';

/**
 * Default sub ID for token minting
 */
export const DEFAULT_SUB_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Helper class for interacting with the Fuel contract
 */
export class FuelHelper {
  public readonly contract: Fuel;
  public readonly id: string;

  constructor(contract: Fuel) {
    this.contract = contract;
    this.id = contract.id.toB256();
  }

  /**
   * Get the asset ID for the FUEL token
   */
  getAssetId(subId: string = DEFAULT_SUB_ID): string {
    // Asset ID is derived from contract ID + sub ID
    // In Sway, this is: sha256((contract_id, sub_id))
    return this.id; // Simplified - actual implementation may need sha256
  }

  /**
   * Mint FUEL tokens to a recipient
   */
  async mint(
    sender: Account,
    recipient: string,
    amount: BigNumberish,
    subId: string = DEFAULT_SUB_ID
  ): Promise<void> {
    const recipientIdentity: IdentityInput = {
      Address: { bits: recipient },
    };

    const { waitForResult } = await this.contract
      .functions
      .mint(recipientIdentity, subId, amount)
      .call();

    await waitForResult();
  }

  /**
   * Burn FUEL tokens from the caller
   */
  async burn(
    sender: Account,
    subId: string,
    amount: BigNumberish
  ): Promise<void> {
    const { waitForResult } = await this.contract
      .functions
      .burn(subId, amount)
      .call();

    await waitForResult();
  }

  /**
   * Get the owner of the contract
   */
  async owner(): Promise<string | null> {
    const { value } = await this.contract.functions.owner().get();
    if (value.Initialized) {
      return value.Initialized.Address?.bits ?? null;
    }
    return null;
  }

  /**
   * Get total number of assets
   */
  async totalAssets(): Promise<BN> {
    const { value } = await this.contract.functions.total_assets().get();
    return value;
  }

  /**
   * Get total supply of an asset
   */
  async totalSupply(assetId: string): Promise<BN | null> {
    const { value } = await this.contract
      .functions
      .total_supply({ bits: assetId })
      .get();
    return value ?? null;
  }
}
