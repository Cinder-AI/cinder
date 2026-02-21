import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import BaseModel


def now_iso() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def to_sse(event_name: str, data: BaseModel | dict[str, Any], event_id: str | None = None) -> str:
    """Format data as SSE message."""
    payload = data.model_dump_json() if isinstance(data, BaseModel) else json.dumps(data, ensure_ascii=False)
    lines: list[str] = []
    if event_id:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event_name}")
    lines.append(f"data: {payload}")
    return "\n".join(lines) + "\n\n"


def parse_int(value: str | int | None, default: int = 0) -> int:
    """Parse value to int with default fallback."""
    if value is None:
        return default
    if isinstance(value, int):
        return value
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_float(value: str | int | float | None, default: float = 0.0) -> float:
    """Parse value to float with default fallback."""
    if value is None:
        return default
    if isinstance(value, float):
        return value
    if isinstance(value, int):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def scaled_to_price(price_scaled: str | None) -> float:
    """Convert scaled price (1e9) to human-readable float."""
    if not price_scaled:
        return 0.0
    try:
        return float(Decimal(price_scaled) / Decimal(1_000_000_000))
    except (InvalidOperation, ValueError):
        return 0.0


def to_usd(amount_in_fuel: float | None, fuel_usd: float | None) -> float | None:
    """Convert FUEL amount to USD."""
    if amount_in_fuel is None or fuel_usd is None:
        return None
    return round(amount_in_fuel * fuel_usd, 12)
