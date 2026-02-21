import json
from typing import Any
from urllib import request as urllib_request

from fastapi import HTTPException

from config import INDEXER_URL, HASURA_ADMIN_SECRET
from schemas import TradeRow, CampaignRow


def graphql_endpoint() -> str:
    """Return the GraphQL endpoint URL."""
    if INDEXER_URL.endswith("/v1/graphql"):
        return INDEXER_URL
    return f"{INDEXER_URL.rstrip('/')}/v1/graphql"


def _make_graphql_request(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    """Make a GraphQL request and return the response data."""
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if HASURA_ADMIN_SECRET:
        headers["x-hasura-admin-secret"] = HASURA_ADMIN_SECRET

    payload = {"query": query, "variables": variables}
    body = json.dumps(payload).encode("utf-8")
    req = urllib_request.Request(graphql_endpoint(), data=body, headers=headers, method="POST")

    with urllib_request.urlopen(req, timeout=10) as resp:  # nosec B310 - URL is controlled by env
        if resp.status != 200:
            raise HTTPException(status_code=502, detail=f"Indexer GraphQL request failed: {resp.status}")
        return json.loads(resp.read().decode("utf-8"))


def fetch_trades(campaign_id: str, from_ts: int, to_ts: int) -> list[TradeRow]:
    """Fetch trades for a campaign within a time range."""
    query_template = """
    query Trades($campaignId: String!, $from: {ts_type}!, $to: {ts_type}!) {{
      Trade(
        where: {{
          campaign_id: {{ _eq: $campaignId }}
          timestamp: {{ _gte: $from, _lte: $to }}
          price_scaled: {{ _is_null: false }}
        }}
        order_by: [{{ timestamp: asc }}, {{ block_height: asc }}]
      ) {{
        id
        campaign_id
        side
        amount_token
        amount_base
        price_scaled
        price
        timestamp
        block_height
      }}
    }}
    """

    last_errors: list[dict[str, Any]] | None = None

    # Different deployments expose Trade.timestamp as numeric or bigint.
    for ts_type in ("numeric", "bigint"):
        query = query_template.format(ts_type=ts_type)
        data = _make_graphql_request(query, {
            "campaignId": campaign_id,
            "from": str(from_ts),
            "to": str(to_ts)
        })

        errors = data.get("errors")
        if not errors:
            trades = data.get("data", {}).get("Trade", [])
            return [TradeRow.model_validate(item) for item in trades]

        last_errors = errors
        errors_str = json.dumps(errors, ensure_ascii=False)
        if "where 'numeric' is expected" in errors_str or "where 'bigint' is expected" in errors_str:
            continue
        raise HTTPException(status_code=502, detail=f"Indexer GraphQL errors: {errors}")

    raise HTTPException(status_code=502, detail=f"Indexer GraphQL errors: {last_errors}")


def fetch_campaign_row(campaign_id: str) -> CampaignRow | None:
    """Fetch a single campaign row by ID."""
    query = """
    query CampaignSnapshot($campaignId: String!) {
      Campaign(where: { id: { _eq: $campaignId } }, limit: 1) {
        id
        current_price
        current_price_scaled
        total_volume_base
        total_pledged
        curve_sold_supply
        curve_max_supply
        token_decimals
        status
      }
    }
    """

    data = _make_graphql_request(query, {"campaignId": campaign_id})

    errors = data.get("errors")
    if errors:
        raise HTTPException(status_code=502, detail=f"Indexer GraphQL errors: {errors}")

    rows = data.get("data", {}).get("Campaign", [])
    if not rows:
        return None
    return CampaignRow.model_validate(rows[0])
