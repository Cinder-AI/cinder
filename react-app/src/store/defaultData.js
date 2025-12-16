import ELON from '../assets/tokens/ELON.jpg'
import WAIFU from '../assets/tokens/WAIFU.jpg'
import MRJIM from '../assets/tokens/MRJIM.jpg'
import NICK from '../assets/tokens/NICK.png'
import PEPE from '../assets/tokens/PEPE.png'
import PENGU from '../assets/tokens/PENGU.jpeg'
import AI16Z from '../assets/tokens/AI16Z.png'
import BERT from '../assets/tokens/BERT.png'
import BULLA from '../assets/tokens/BULLA.png'
import DOGE from '../assets/tokens/DOGE.png'
import TRUMP from '../assets/tokens/TRUMP.jpg' 
import ELON_VIDEO from '../assets/tokens/ELON.mp4'
import TRUMP_VIDEO from '../assets/tokens/TRUMP.mp4'
import WAIFU_VIDEO from '../assets/WAIFU.mp4'

export function createDefaultState() {
  const CAMPAIGN_TARGET = 1000000; // 1M stFUEL target for launch
  
  const tokens = [
    // Системные токены - без кампаний, уже запущены
    { 
      id: 1, 
      name: 'stFUEL', 
      image: 'assets/stFUEL.png', 
      creator: 'system', 
      progress: 100, 
      timeAgo: 'genesis', 
      isSystemToken: true 
    },
    { 
      id: 2, 
      name: 'CIN', 
      image: 'assets/CIN.png', 
      creator: 'system', 
      progress: 100, 
      timeAgo: 'genesis', 
      isSystemToken: true 
    },
    { 
      id: 4, 
      name: 'ELON', 
      ticker: '$ELON', 
      description: 'Elon Musk', 
      image: ELON, 
      media: {
        type: 'video',
        src: ELON_VIDEO,
        poster: ELON
      },
      creator: 'Zupp',
      isSystemToken: false,
      status: 'active',
      assetId: '0x0000000000000000000000000000000000000000000000000000000000000004',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 415000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      progress: 41.5,
      timeAgo: '2m ago',
      price: 0.00000558,
      isBoosted: false
    },

    {
      id: 14,
      name: 'TRUMP',
      ticker: '$TRUMP',
      description: 'Donald Trump',
      image: TRUMP,
      media: {
        type: 'video',
        src: TRUMP_VIDEO,
        poster: TRUMP
      },
      creator: 'MemeForge',
      isSystemToken: false,
      status: 'active',
      assetId: '0x000000000000000000000000000000000000000000000000000000000000000E',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 0,
      progress: 0,
      timeAgo: '2hr ago',
    },
    { 
      id: 3,
      name: 'WaiFU',
      ticker: '$WaiFU',
      description: 'Digital AI Companion',
      image: WAIFU,
      media: {
        type: 'video',
        src: WAIFU_VIDEO,
        poster: WAIFU
      },
      creator: 'KawaiiLaunch',
      isSystemToken: false,
      status: 'active',
      assetId: '0x0000000000000000000000000000000000000000000000000000000000000003',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 790000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      progress: 79,
      timeAgo: '50m ago',
      price: 0.00000558,
      marketCap: 17300
    },
    {
      id: 8,
      name: 'PEPE',
      ticker: '$PEPE',
      description: 'PEPE',
      image: PEPE,
      creator: 'pepekek',
      isSystemToken: false,
      status: 'active',
      assetId: '0x0000000000000000000000000000000000000000000000000000000000000008',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 550000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      progress: 55,
      timeAgo: '2hr ago'
    },
    { 
      id: 7, 
      name: 'GIGA', 
      ticker: '$GIGA', 
      description: 'Gigachad', 
      image: NICK, 
      creator: 'gigachad',
      isSystemToken: false,
      status: 'active',
      assetId: '0x0000000000000000000000000000000000000000000000000000000000000007',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 300000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      progress: 30,
      timeAgo: '45m ago'
    },
    { 
      id: 6, 
      assetId: '0x0000000000000000000000000000000000000000000000000000000000000006',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      name: 'Mr. Jim', 
      ticker: '$MRJIM', 
      description: 'Mr. Jim', 
      image: MRJIM, 
      creator: 'jimhodler',
      progress: 20,
      isSystemToken: false,
      status: 'active',
      totalPledged: 200000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      timeAgo: '2m ago'
    },
    {
      id: 9,
      name: 'Pengu',
      ticker: '$PENGU',
      description: 'Pudgy Penguins',
      image: PENGU,
      creator: 'penguking',
      isSystemToken: false,
      status: 'active',
      assetId: '0x0000000000000000000000000000000000000000000000000000000000000009',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 650000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      progress: 65,
      timeAgo: '3hr ago'
    },
    {
      id: 10,
      name: 'AI16Z',
      ticker: '$AI16Z',
      description: 'AI16Z',
      image: AI16Z,
      creator: 'ai16z',
      isSystemToken: false,
      status: 'active',
      assetId: '0x000000000000000000000000000000000000000000000000000000000000000A',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 420000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      progress: 42,
      timeAgo: '6hr ago'
    },
    {
      id: 11,
      name: 'BERT',
      ticker: '$BERT',
      description: 'BERT',
      image: BERT,
      creator: 'bertdev',
      isSystemToken: false,
      status: 'active',
      assetId: '0x000000000000000000000000000000000000000000000000000000000000000B',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 350000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      progress: 35,
      timeAgo: '1d ago'
    },
    {
      id: 12,
      name: 'BULLA',
      ticker: '$BULLA',
      description: 'Hasbullah',
      image: BULLA,
      creator: 'bullrun',
      isSystemToken: false,
      status: 'active',
      assetId: '0x000000000000000000000000000000000000000000000000000000000000000C',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 720000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      progress: 92,
      timeAgo: '30m ago'
    },
    {
      id: 13,
      name: 'DOGE',
      ticker: '$DOGE',
      description: 'Doge',
      image: DOGE,
      creator: 'dogearmy',
      isSystemToken: false,
      status: 'active',
      assetId: '0x000000000000000000000000000000000000000000000000000000000000000D',
      subId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      totalPledged: 180000,
      totalSupply: 0,
      target: CAMPAIGN_TARGET,
      progress: 18,
      timeAgo: '6hr ago'
    }
  ];
  console.log(tokens);

  const userHoldings = new Map([
    [1, { amount: 250000, value: 250.0, canSell: false }],
    [2, { amount: 1000000, value: 50.0, canSell: true }],
    [3, { amount: 12500, value: 15600, canSell: true }],
    [4, { amount: 5000, value: 8250, canSell: true }],
  ]);

  const user = { balance: '250k stFUEL' };

  const nextTokenId = calculateNextTokenId(tokens);

  return { tokens, userHoldings, user, nextTokenId };
}

export function calculateNextTokenId(tokens) {
  const userTokens = tokens.filter(t => !t.isSystemToken);
  if (userTokens.length === 0) return 3;
  return Math.max(...userTokens.map(t => t.id)) + 1;
}