from schemas import TradeRow, CandlePoint, ChartSeriesPoint, ChartSummary
from utils import parse_int, parse_float, scaled_to_price, to_usd


def build_chart_points(
    trades: list[TradeRow], interval_sec: int, fuel_usd: float | None = None
) -> tuple[list[ChartSeriesPoint], list[CandlePoint]]:
    """Build chart series points and candle data from trades."""
    if not trades:
        return [], []

    series: list[ChartSeriesPoint] = []
    candles_map: dict[int, CandlePoint] = {}

    for trade in trades:
        ts = parse_int(trade.timestamp)
        price_scaled = trade.price_scaled
        if ts <= 0 or not price_scaled:
            continue

        price_value = scaled_to_price(price_scaled)
        series.append(
            ChartSeriesPoint(
                t=ts,
                price_scaled=price_scaled,
                price=price_value,
                price_usd=to_usd(price_value, fuel_usd)
            )
        )

        bucket = (ts // interval_sec) * interval_sec
        amount_base = parse_int(trade.amount_base)
        amount_token = parse_int(trade.amount_token)

        if bucket not in candles_map:
            candles_map[bucket] = CandlePoint(
                t=bucket,
                o=price_scaled,
                h=price_scaled,
                l=price_scaled,
                c=price_scaled,
                v_base=str(amount_base),
                v_token=str(amount_token),
                n=1,
            )
            continue

        candle = candles_map[bucket]
        candle.c = price_scaled
        candle.h = str(max(parse_int(candle.h), parse_int(price_scaled)))
        candle.l = str(min(parse_int(candle.l), parse_int(price_scaled)))
        candle.v_base = str(parse_int(candle.v_base) + amount_base)
        candle.v_token = str(parse_int(candle.v_token) + amount_token)
        candle.n += 1

    candles = sorted(candles_map.values(), key=lambda c: c.t)
    return series, candles


def fill_candle_gaps(
    candles: list[CandlePoint], from_ts: int, to_ts: int, interval_sec: int
) -> list[CandlePoint]:
    """Fill gaps in candle data with empty candles using previous close price."""
    if not candles:
        return []

    start_bucket = (from_ts // interval_sec) * interval_sec
    end_bucket = (to_ts // interval_sec) * interval_sec
    by_bucket = {candle.t: candle for candle in candles}
    filled: list[CandlePoint] = []
    last_close = candles[0].o

    for bucket in range(start_bucket, end_bucket + 1, interval_sec):
        candle = by_bucket.get(bucket)
        if candle is not None:
            filled.append(candle)
            last_close = candle.c
            continue

        filled.append(
            CandlePoint(
                t=bucket,
                o=last_close,
                h=last_close,
                l=last_close,
                c=last_close,
                v_base="0",
                v_token="0",
                n=0,
            )
        )

    return filled


def build_chart_summary(trades: list[TradeRow], fuel_usd: float | None = None) -> ChartSummary:
    """Build summary statistics from trades."""
    if not trades:
        return ChartSummary()

    valid_prices = [trade.price_scaled for trade in trades if trade.price_scaled]
    if not valid_prices:
        volume_base = sum(parse_int(trade.amount_base) for trade in trades)
        return ChartSummary(
            volumeBase=str(volume_base),
            volumeUsd=to_usd(float(volume_base), fuel_usd),
            volumeToken=str(sum(parse_int(trade.amount_token) for trade in trades)),
            tradeCount=len(trades),
        )

    first_scaled = valid_prices[0]
    last_scaled = valid_prices[-1]
    high_scaled = max(valid_prices, key=parse_int)
    low_scaled = min(valid_prices, key=parse_int)

    first_price = scaled_to_price(first_scaled)
    last_price = scaled_to_price(last_scaled)
    change_pct = 0.0
    if first_price > 0:
        change_pct = round(((last_price - first_price) / first_price) * 100, 4)

    volume_base = sum(parse_int(trade.amount_base) for trade in trades)
    return ChartSummary(
        firstPriceScaled=first_scaled,
        lastPriceScaled=last_scaled,
        firstPrice=first_price,
        firstPriceUsd=to_usd(first_price, fuel_usd),
        lastPrice=last_price,
        lastPriceUsd=to_usd(last_price, fuel_usd),
        priceChangePct=change_pct,
        highPriceScaled=high_scaled,
        lowPriceScaled=low_scaled,
        highPrice=scaled_to_price(high_scaled),
        highPriceUsd=to_usd(scaled_to_price(high_scaled), fuel_usd),
        lowPrice=scaled_to_price(low_scaled),
        lowPriceUsd=to_usd(scaled_to_price(low_scaled), fuel_usd),
        volumeBase=str(volume_base),
        volumeUsd=to_usd(float(volume_base), fuel_usd),
        volumeToken=str(sum(parse_int(trade.amount_token) for trade in trades)),
        tradeCount=len(trades),
    )
