import React, { useEffect, useState } from "react";
import { useWallet } from "@fuels/react";
import { Address, B256Address, Wallet, getAllDecodedLogs } from "fuels";
import { getContracts } from "../config/contracts.ts";
import { Launchpad } from "../sway-api/contracts/Launchpad";
import { fuelGraphQL } from "../services/fuelGraphQL.ts";
import { Fuel } from "../sway-api/contracts/Fuel.ts";
import { reactorConfig } from "../config/reactor.ts";
import { createPoolAndSeedLiquidity, readPoolState, swapExactInWithQuote } from "../modules/reactorDex.ts";
import reactorPoolAbi from "../abi/reactorPoolAbi.json";

export const ContractTest = () => {
  const { wallet } = useWallet();
  const [ids, setIds] = useState<B256Address | null>(null);

  const getCampaigns = async () => {
    if (!wallet) return;
    const ids = await getContracts();
    const contract = new Launchpad(ids.LAUNCHPAD, wallet);
    const { value: campaigns } = await contract.functions.get_campaigns().get();
    console.log("campaigns", campaigns);
  }

  const getFuelName = async () => {
    if (!wallet) return;
    const ids = await getContracts();
    const contract = new Fuel(ids.FUEL, wallet);
    const { value: name } = await contract.functions.name({ bits: "0xfba063468d96e0f16b2e487921d0064c52e0964cd1716e6bdbfd2c16911e1dec" }).get();
    console.log("name", name);
    const { value: symbol } = await contract.functions.symbol({ bits: "0xfba063468d96e0f16b2e487921d0064c52e0964cd1716e6bdbfd2c16911e1dec" }).get();
    console.log("symbol", symbol);
    const { value: decimals } = await contract.functions.decimals({ bits: "0xfba063468d96e0f16b2e487921d0064c52e0964cd1716e6bdbfd2c16911e1dec" }).get();
    console.log("decimals", decimals);
    const { value: totalSupply } = await contract.functions.total_supply({ bits: "0xfba063468d96e0f16b2e487921d0064c52e0964cd1716e6bdbfd2c16911e1dec" }).get();
    console.log("totalSupply", totalSupply);
  }

  useEffect(() => {
    if (!wallet) return;
    (async () => {
      const ids = await getContracts();
      console.log("wallet", wallet.address.toB256());
      console.log("ids", ids);
      setIds(ids.LAUNCHPAD);
    })();
    getCampaigns();
    getFuelName();
  }, [wallet]);

  const testAssetId = "0x14d6727320ae86edd0c0d386052802b8447ebd2061d2e0eebb560924a92984cd";
  console.log("testAssetId", testAssetId);

  const initContract = async () => {
    if (!wallet) return;
    const ids = await getContracts();
    console.log("ids", ids);
    const contract = new Launchpad(ids.LAUNCHPAD, wallet);
    const { waitForResult } = await contract.functions
      .initialize({ Address: { bits: wallet.address.toB256() } })
      .call();
    const result = await waitForResult();
    console.log("result", result);
  }

  const denyCampaign = async (assetId: string) => {
    if (!wallet) return;
    const ids = await getContracts();
    const contract = new Launchpad(ids.LAUNCHPAD, wallet);
    const { waitForResult } = await contract.functions
      .deny_campaign({ bits: assetId })
      .call();
    const result = await waitForResult();
    console.log("result", result);
  }

  const launchCampaign = async (assetId: string) => {
    if (!wallet) return;
    const ids = await getContracts();
    const contract = new Launchpad(ids.LAUNCHPAD, wallet);
    const { waitForResult } = await contract.functions
      .launch_campaign({ bits: assetId })
      .call();
    const result = await waitForResult();
    console.log("result", result);
  }

  const initFuelContract = async () => {
    if (!wallet) return;
    const ids = await getContracts();
    const contract = new Fuel(ids.FUEL, wallet);
    const { waitForResult } = await contract.functions
      .initialize({ Address: { bits: wallet.address.toB256() } })
      .call();
    const result = await waitForResult();
    console.log("result", result);
  }

  const createReactorPool = async () => {
    if (!wallet) {
      console.error("Wallet not connected");
      return;
    }

    const baseAssetId = "0x60cf8cfde5ea5885829caafdcc3583114c90f74816254c75af8cedca050b0d0d"; // FUEL
    const tokenAssetId = "0x14d6727320ae86edd0c0d386052802b8447ebd2061d2e0eebb560924a92984cd"; // BERT

    try {
      const tx = await createPoolAndSeedLiquidity({
        wallet,
        reactorPoolContractId: reactorConfig.reactorPoolContractId,
        tokenAssetId,
        quoteAssetId: baseAssetId,
        tokenDecimals: 9,
        quoteDecimals: 9,
        tokenAmount: 100,
        quoteAmount: 200,
        feeTier: reactorConfig.feeTier,
        priceLower: 1,
        priceUpper: 1000,
        deadlineBlocks: reactorConfig.deadlineBlocks,
      });

      console.log("Pool create+seed tx:", tx);
      const decoded = getAllDecodedLogs({
        receipts: tx.receipts,
        mainAbi: reactorPoolAbi as any,
        externalAbis: {
          [reactorConfig.reactorPoolContractId.toLowerCase()]: reactorPoolAbi as any,
        },
      });
      console.log("Reactor decoded logs:", decoded.logs);
      console.log("Reactor grouped logs:", decoded.groupedLogs);
    } catch (error) {
      console.error("createReactorPool failed:", error);
    }
  }

  const getReactorPoolState = async () => {
    if (!wallet) {
      console.error("Wallet not connected");
      return;
    }

    const baseAssetId = "0x60cf8cfde5ea5885829caafdcc3583114c90f74816254c75af8cedca050b0d0d"; // FUEL
    const tokenAssetId = "0x14d6727320ae86edd0c0d386052802b8447ebd2061d2e0eebb560924a92984cd"; // BERT

    try {
      const state = await readPoolState({
        wallet,
        reactorPoolContractId: reactorConfig.reactorPoolContractId,
        token0: tokenAssetId,
        token1: baseAssetId,
        feeTier: reactorConfig.feeTier,
      });
      
      console.log("Reactor pool state:", state);
    } catch (error) {
      console.error("getReactorPoolState failed:", error);
    }
  }

  const swapReactorPool = async () => {
    if (!wallet) {
      console.error("Wallet not connected");
      return;
    }

    const baseAssetId = "0x60cf8cfde5ea5885829caafdcc3583114c90f74816254c75af8cedca050b0d0d"; // FUEL
    const tokenAssetId = "0x14d6727320ae86edd0c0d386052802b8447ebd2061d2e0eebb560924a92984cd"; // BERT
    const amountInBase = 1_000_000_000n; // 1.0 with 9 decimals

    try {
      const tx = await swapExactInWithQuote({
        wallet,
        reactorPoolContractId: reactorConfig.reactorPoolContractId,
        poolId: [tokenAssetId, baseAssetId, reactorConfig.feeTier],
        tokenInId: baseAssetId,
        tokenOutId: tokenAssetId,
        amountIn: amountInBase,
        slippageBps: reactorConfig.defaultSlippageBps,
        deadlineBlocks: reactorConfig.deadlineBlocks,
      });

      console.log("swapReactorPool tx:", tx);
      const decoded = getAllDecodedLogs({
        receipts: tx.receipts,
        mainAbi: reactorPoolAbi as any,
        externalAbis: {
          [reactorConfig.reactorPoolContractId.toLowerCase()]: reactorPoolAbi as any,
        },
      });
      console.log("swap decoded logs:", decoded.logs);
      console.log("swap grouped logs:", decoded.groupedLogs);
    } catch (error) {
      console.error("swapReactorPool failed:", error);
    }
  }

  return (
    <div>
      <button onClick={initContract}>init</button>
      <button onClick={() => denyCampaign(testAssetId)}>deny</button>
      <button onClick={() => launchCampaign(testAssetId)}>launch</button>
      <button onClick={initFuelContract}>init fuel</button>
      <button onClick={createReactorPool}>Create Reactor Pool</button>
      <button onClick={getReactorPoolState}>Get Reactor Pool State</button>
      <button onClick={swapReactorPool}>Swap Reactor Pool</button>
    </div>
  )
}