/**
 * CoinMarketCap USD price feed for FUEL token.
 * Ported from sse-service/app/cmc.py
 */

export interface FuelUsdQuote {
  price: number;
  updated_at: string | null;
  source: string;
}

export class CoinMarketCapFeed {
  private _apiKey: string | null;
  private _symbol: string;
  private _convert: string;
  private _pollSeconds: number;
  private _endpoint: string | null;

  private _quote: FuelUsdQuote | null = null;
  private _lock: { [key: string]: any } = {}; // Simple mutex simulation
  private _task: any = null;
  private _running = false;

  constructor(
    apiKey: string | null,
    endpoint: string | null,
    symbol: string = "FUEL",
    convert: string = "USD",
    pollSeconds: number = 20,
  ) {
    this._apiKey = apiKey;
    this._symbol = symbol;
    this._convert = convert;
    this._pollSeconds = Math.max(5, pollSeconds);
    this._endpoint = this._normalizeEndpoint(endpoint);
  }

  private _normalizeEndpoint(endpoint: string | null): string | null {
    if (!endpoint) {
      return null;
    }
    let raw = endpoint.trim().replace(/\.$/, '');
    if (!raw) {
      return null;
    }

    try {
      const parsed = new URL(raw);
      if (!parsed.protocol) {
        raw = `https://${raw}`;
      }
      let path = parsed.pathname;
      if (!path) {
        path = '/v1/cryptocurrency/quotes/latest';
      } else if (path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      // Reconstruct URL
      const finalUrl = new URL(path, raw);
      return finalUrl.toString();
    } catch {
      return null;
    }
  }

  async start(): Promise<void> {
    if (this._task !== null) {
      return;
    }
    if (!this._apiKey || !this._endpoint) {
      return;
    }
    this._running = true;
    this._task = setInterval(() => {
      void this._pollLoop();
    }, this._pollSeconds * 1000);
    // Initial fetch
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
    // Simple lock simulation - in Node.js we'd use a mutex, but for simplicity we just return
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
        // Keep last known quote on transient upstream failures.
        console.error('CoinMarketCap feed error:', error);
      }
      await this._sleep(this._pollSeconds * 1000);
    }
  }

  private async _fetchOnce(): Promise<FuelUsdQuote | null> {
    if (!this._apiKey || !this._endpoint) {
      return null;
    }

    try {
      const url = new URL(this._endpoint);
      url.searchParams.set('symbol', this._symbol);
      url.searchParams.set('convert', this._convert);

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'X-CMC_PRO_API_KEY': this._apiKey,
        },
        method: 'GET',
      });

      if (response.status !== 200) {
        return null;
      }

      const payload: any = await response.json();

      const rows = payload.data?.[this._symbol];
      let entry: any = null;

      if (Array.isArray(rows) && rows.length > 0) {
        entry = rows[0];
      } else if (rows && typeof rows === 'object') {
        entry = rows;
      }

      if (!entry) {
        return null;
      }

      const usdQuote = entry.quote?.USD;
      if (!usdQuote) {
        return null;
      }

      const price = usdQuote.price;
      if (price === undefined) {
        return null;
      }

      const updated_at = usdQuote.last_updated || null;

      return {
        price: Number(price),
        updated_at: updated_at,
        source: 'coinmarketcap',
      };
    } catch (error) {
      console.error('CoinMarketCap fetch error:', error);
      return null;
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
