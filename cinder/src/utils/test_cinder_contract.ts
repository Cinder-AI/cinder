import { Cinder } from "../sway-api/contracts/Cinder";
import { WalletUnlocked } from "fuels";
import { fuelGraphQL } from "../services/fuelGraphQL";

export const testCinderContract = async (contract: Cinder, wallet: WalletUnlocked) => {
    const walletAddress = wallet.address.toString().toLowerCase()      ;
    // test total_assets
    console.log("wallet", walletAddress);
    const { value } = await contract.functions.total_assets().get();
    const totalAssets = value.toNumber();
    console.log("totalAssets", totalAssets);

    // test default_asset
    const { value: defaultAsset } = await contract.functions.default_asset().get();
    console.log("defaultAsset", defaultAsset);

    const { value: defaultSubId } = await contract.functions.default_sub_id().get();
    console.log("defaultSubId", defaultSubId);

    const { value: assetInfo } = await contract.functions.asset_info(defaultAsset).get();
    console.log("assetInfo", assetInfo);

    const { value: name } = await contract.functions.name(defaultAsset).get();
    console.log("name", name);
    
    const { value: symbol } = await contract.functions.symbol(defaultAsset).get();
    console.log("symbol", symbol);

    const { value: decimals } = await contract.functions.decimals(defaultAsset).get();
    console.log("decimals", decimals);

    const { value: totalSupply } = await contract.functions.total_supply(defaultAsset).get();
    console.log("totalSupply", totalSupply?.toNumber());

    // const mintInput = { Address: { bits: walletAddress } };
    // await contract.functions.mint(mintInput, defaultSubId, 100).call();

    // // test initialize
    // const identityInput = { Address: { bits: wallet.address.toString() } };
    // await contract.functions.initialize(identityInput).call();

    // test owner
    // const { value: owner } = await contract.functions.owner().get();
    // const ownerAddress = owner.Initialized?.Address?.bits
    // console.log("ownerAddress", ownerAddress, "type", typeof ownerAddress);
    // console.log("wallet address", walletAddress, "type", typeof walletAddress);
    // console.log("check if owner is the same as the wallet", ownerAddress === walletAddress);

    // const identityInput = { Address: { bits: contract.id.toString() } };
    // await contract.functions.set_owner(identityInput).call();



}