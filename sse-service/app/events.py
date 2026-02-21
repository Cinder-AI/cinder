from typing import Literal

from cmc import CoinMarketCapFeed
from schemas import CampaignRow, CampaignUpdatedEventData, TradeRow, TradeCreatedEventData
from utils import parse_int, parse_float, scaled_to_price, to_usd, now_iso


async def build_campaign_updated_event_data(
    row: CampaignRow,
    cmc_feed: CoinMarketCapFeed,
    op: Literal["INSERT", "UPDATE", "DELETE", "MANUAL"] = "MANUAL"
) -> CampaignUpdatedEventData:
    """Build campaign updated event data from a campaign row."""
    sold_supply = parse_int(row.curve_sold_supply)
    max_supply = parse_int(row.curve_max_supply)
    token_decimals = row.token_decimals or 0
    progress = round((sold_supply / max_supply) * 100, 4) if max_supply > 0 else None
    market_cap_base = None
    current_price_scaled_int = parse_int(row.current_price_scaled)
    if current_price_scaled_int > 0 and max_supply > 0:
        supply_human = max_supply
        if token_decimals > 0:
            supply_human = max_supply // (10**token_decimals)
        market_cap_base = str((current_price_scaled_int * supply_human) // 1_000_000_000)

    quote = await cmc_feed.get_quote()
    current_price_fuel = scaled_to_price(row.current_price_scaled)
    volume_base_fuel = parse_float(row.total_volume_base)
    market_cap_base_fuel = parse_float(market_cap_base) if market_cap_base is not None else None

    return CampaignUpdatedEventData(
        op=op,
        campaignId=row.id,
        currentPrice=row.current_price,
        currentPriceScaled=row.current_price_scaled,
        currentPriceUsd=to_usd(current_price_fuel, quote.price if quote else None),
        totalVolumeBase=row.total_volume_base,
        totalVolumeUsd=to_usd(volume_base_fuel, quote.price if quote else None),
        totalPledged=row.total_pledged,
        progress=progress,
        curveSoldSupply=row.curve_sold_supply,
        curveMaxSupply=row.curve_max_supply,
        marketCapBase=market_cap_base,
        marketCapUsd=to_usd(market_cap_base_fuel, quote.price if quote else None),
        fuelUsd=quote.price if quote else None,
        fuelUsdUpdatedAt=quote.updated_at if quote else None,
        status=row.status,
        updatedAt=now_iso(),
    )


def build_trade_created_event_data(
    row: TradeRow,
    fuel_usd: float | None = None,
    fuel_usd_updated_at: str | None = None
) -> TradeCreatedEventData:
    """Build trade created event data from a trade row."""
    price_fuel = scaled_to_price(row.price_scaled)

    return TradeCreatedEventData(
        tradeId=row.id,
        campaignId=row.campaign_id,
        side=row.side,
        amountBase=row.amount_base,
        amountToken=row.amount_token,
        priceScaled=row.price_scaled,
        price=row.price,
        priceUsd=to_usd(price_fuel, fuel_usd),
        timestamp=row.timestamp,
        blockHeight=row.block_height,
        fuelUsd=fuel_usd,
        fuelUsdUpdatedAt=fuel_usd_updated_at,
        updatedAt=now_iso(),
    )
