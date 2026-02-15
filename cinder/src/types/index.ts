import { AssetId, SubId } from "fuels";

export enum CampaignStatus {
    Active = "active",
    Launched = "launched",
    Failed = "failed",
}

interface Campaign {
    creator: string;
    status: CampaignStatus;
    tokenId: AssetId;
    subId: SubId;
    totalPledged: number;
    totalSupply: number;
    token: Token;
}

interface TokenMedia {
    type: 'video' | 'image';
    src: string;
    poster?: string;
}

interface Token {
    id: number;
    assetId: AssetId;
    subId: SubId;
    name: string;
    ticker: string;
    description: string;
    image: string;
    media?: TokenMedia;
    creator: string;
    progress: number;
    timeAgo: string;
    isSystemToken: boolean;
    totalPledged: number;
    totalSupply: number;
    target: number;
    marketCap: number;
    price: number;
    price24Change: number;
    volume24h: number;
    isBoosted: boolean;
}

export type { Campaign, Token, TokenMedia };