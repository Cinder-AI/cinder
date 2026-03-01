/**
 * O2 DEX price feed for FUEL token.
 */

export interface FuelUsdQuote {
  price: number;
  updated_at: string | null;
  source: string;
  change_24h?: number;
  high_24h?: number;
  low_24h?: number;
  volume_24h?: string;
}

export class FuelPriceFeed {
  private _pollSeconds: number;

  private _quote: FuelUsdQuote | null = null;
  private _task: any = null;
  private _running = false;

  private static readonly O2_MARKET_ID = '0x3074a3b0290306e78968896e1ea7f91f15bb13da1d2e06cc50d714deb75ea0d2';
  private static readonly API_URL = 'https://api.o2.app/v1/markets/summary';

  constructor(pollSeconds: number = 20) {
    this._pollSeconds = Math.max(5, pollSeconds);
  }

  async start(): Promise<void> {
    if (this._task !== null) {
      return;
    }
    this._running = true;
    this._task = setInterval(() => {
      void this._pollLoop();
    }, this._pollSeconds * 1000);
    void this._pollLoop();
  }

  async stop(): Promise<void> {
    this._running = false;
    if (this._task !== null) {
      clearInterval(this._task);
      this._task = null;
    }
  }

  async getQuote(): Promise<FuelUsdQuote | null> {
    return this._quote;
  }

  private async _pollLoop(): Promise<void> {
    while (this._running) {
      try {
        const quote = await this._fetchOnce();
        if (quote !== null) {
          this._quote = quote;
        }
      } catch (error) {
        console.error('O2 feed error:', error);
      }
      await this._sleep(this._pollSeconds * 1000);
    }
  }

  private async _fetchOnce(): Promise<FuelUsdQuote | null> {
    try {
      const url = new URL(FuelPriceFeed.API_URL);
      url.searchParams.set('market_id', FuelPriceFeed.O2_MARKET_ID);

      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        method: 'GET',
      });

      if (response.status !== 200) {
        return null;
      }

      const data: any = await response.json();

      const lastPrice = data.last_price;
      if (lastPrice === undefined) {
        return null;
      }

      return {
        price: Number(lastPrice) / 1_000_000, // O2 использует 6 decimals
        updated_at: new Date().toISOString(),
        source: 'o2',
        change_24h: data.change_24h ? Number(data.change_24h) : undefined,
        high_24h: data.high_price ? Number(data.high_price) / 1_000_000 : undefined,
        low_24h: data.low_price ? Number(data.low_price) / 1_000_000 : undefined,
        volume_24h: data.volume_24h,
      };
    } catch (error) {
      console.error('O2 fetch error:', error);
      return null;
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}