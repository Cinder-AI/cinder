import { Launchpad } from "../sway-api/contracts/Launchpad";
import { Amm } from "../sway-api/contracts/Amm";
import { WalletUnlocked } from "fuels";
import { fuelGraphQL } from "../services/fuelGraphQL";

export const testLaunchpadContract = async (contract: Launchpad, ammContract: Amm, wallet: WalletUnlocked) => {
    const walletAddress = wallet.address.toString().toLowerCase();
    // test total_assets

    
    console.log("wallet", walletAddress);
    const { value: assets } = await contract.functions.get_assets().get();
    const totalAssets = assets.length;
    console.log("totalAssets", totalAssets);
    if (totalAssets < 2) {
        const campaigns = await createTestCampaigns(contract, wallet);
        console.log("campaigns", campaigns);
    } else {
        const asset1 = assets[0].asset_id;
        const asset2 = assets[1].asset_id;
        const { value: campaign1 } = await contract.functions.get_campaign(asset1).get();
        const { value: campaign2 } = await contract.functions.get_campaign(asset2).get();
        console.log("campaign1", campaign1);
        console.log("campaign2", campaign2);
        const subId1 = campaign1.sub_id;
        const subId2 = campaign2.sub_id;
        console.log("subId1", subId1);
        console.log("subId2", subId2);
        // const { waitForResult } = await ammContract.functions.create_pool(asset1, asset2).call();
        // const createdPoolId = await waitForResult();
        // console.log("createdPoolId", createdPoolId);
        // const recipient = { Address: { bits: walletAddress } };
        // const { waitForResult: res1 } = await contract.functions.mint(recipient, subId1, 100000).call();
        // const { value: minted1 } = await res1();
        // console.log("minted1", minted1);
        // const { waitForResult: res2 } = await contract.functions.mint(recipient, subId2, 100000).call();
        // const { value: minted2 } = await res2();
        // console.log("minted2", minted2);

        const { waitForResult: res1 } = await ammContract.functions.add_liquidity(
            [asset1, asset2], 1000, 1000
        ).callParams({
            forward: [
                { assetId: asset1, amount: 1000 },
                { assetId: asset2, amount: 1000 },
            ]
            
        }).call();
        const result = await res1();
        console.log("result", result);
    }

    // console.log(assets[0])
    // const { value: campaign } = await contract.functions.get_campaign(assets[0].asset_id).get();
    // console.log("campaign", campaign);

    // const asset1 = assets[0].asset_id;
    // const asset2 = assets[1].asset_id;
    // const { value: campaign1 } = await contract.functions.get_campaign(asset1).get();
    // const { value: campaign2 } = await contract.functions.get_campaign(asset2).get();
    // console.log("campaign1", campaign1);
    // console.log("campaign2", campaign2);

    // const subId1 = campaign1.sub_id;
    // const subId2 = campaign2.sub_id;
    // console.log("subId1", subId1);
    // console.log("subId2", subId2);
    // const { waitForResult } = await ammContract.functions.create_pool(asset1, asset2).call();
    // const createdPoolId = await waitForResult();
    // console.log("createdPoolId", createdPoolId);


    // const assetId = assets[0].asset_id;
    // await contract.functions.launch_campaign(assetId).call();
    // console.log("Launchpad campaign launched");
}

const createTestCampaigns = async (contract: Launchpad, wallet: WalletUnlocked) => {
    const { waitForResult: res1 } = await contract.functions.create_campaign(
        "Test Campaign 1",
        "TEST1",
        "Test Description 1",
        "Test Image 1"
    ).call();
    const { value: campaign } = await res1();
    console.log("campaign", campaign);
    const { waitForResult: res2 } = await contract.functions.create_campaign(
        "Test Campaign 2",
        "TEST2",
        "Test Description 2",
        "Test Image 2"
    ).call();
    const { value: campaign2 } = await res2();
    console.log("campaign2", campaign2);
    return [campaign, campaign2];
}