import asyncio
import json
from dataclasses import dataclass
from typing import Any
from urllib import parse as urllib_parse
from urllib import request as urllib_request


@dataclass
class FuelUsdQuote:
    price: float
    updated_at: str | None = None
    source: str = "coinmarketcap"


class CoinMarketCapFeed:
    def __init__(
        self,
        api_key: str | None,
        endpoint: str | None,
        symbol: str = "FUEL",
        convert: str = "USD",
        poll_seconds: int = 20,
    ) -> None:
        self._api_key = api_key
        self._symbol = symbol
        self._convert = convert
        self._poll_seconds = max(5, poll_seconds)
        self._endpoint = self._normalize_endpoint(endpoint)
        self._quote: FuelUsdQuote | None = None
        self._lock = asyncio.Lock()
        self._task: asyncio.Task[None] | None = None
        self._running = False

    @staticmethod
    def _normalize_endpoint(endpoint: str | None) -> str | None:
        if not endpoint:
            return None
        raw = endpoint.strip().rstrip(".")
        if not raw:
            return None
        parsed = urllib_parse.urlparse(raw)
        if not parsed.scheme:
            raw = f"https://{raw}"
            parsed = urllib_parse.urlparse(raw)
        path = parsed.path.rstrip("/")
        if not path:
            path = "/v1/cryptocurrency/quotes/latest"
        normalized = urllib_parse.urlunparse(
            (parsed.scheme, parsed.netloc, path, parsed.params, parsed.query, parsed.fragment)
        )
        return normalized

    async def start(self) -> None:
        if self._task is not None:
            return
        if not self._api_key or not self._endpoint:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        self._running = False
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def get_quote(self) -> FuelUsdQuote | None:
        async with self._lock:
            return self._quote

    async def _poll_loop(self) -> None:
        while self._running:
            try:
                quote = await asyncio.to_thread(self._fetch_once)
                if quote is not None:
                    async with self._lock:
                        self._quote = quote
            except Exception:
                # Keep last known quote on transient upstream failures.
                pass
            await asyncio.sleep(self._poll_seconds)

    def _fetch_once(self) -> FuelUsdQuote | None:
        if not self._api_key or not self._endpoint:
            return None
        query = urllib_parse.urlencode({"symbol": self._symbol, "convert": self._convert})
        url = f"{self._endpoint}?{query}"
        req = urllib_request.Request(
            url,
            headers={
                "Accept": "application/json",
                "X-CMC_PRO_API_KEY": self._api_key,
            },
            method="GET",
        )
        with urllib_request.urlopen(req, timeout=10) as resp:  # nosec B310 - URL comes from env
            if resp.status != 200:
                return None
            payload: dict[str, Any] = json.loads(resp.read().decode("utf-8"))

        rows = payload.get("data", {}).get(self._symbol)
        entry: dict[str, Any] | None = None
        if isinstance(rows, list) and rows:
            first = rows[0]
            if isinstance(first, dict):
                entry = first
        elif isinstance(rows, dict):
            entry = rows
        if entry is None:
            return None

        usd_quote = entry.get("quote", {}).get("USD", {})
        price = usd_quote.get("price")
        if price is None:
            return None
        updated_at = usd_quote.get("last_updated")
        return FuelUsdQuote(price=float(price), updated_at=updated_at)
