## Contracts Directory Map

This repo contains multiple Sway contracts and shared libraries.

### `contracts/launchpad/`
- `src/main.sw` — core launchpad logic (campaigns, pledge/claim, bonding curve buy/sell).
- `src/utils.sw` — storage helpers (set/delete token metadata, assets list).
- `src/events.sw` — launchpad events.
- `tests/harness.rs` — integration tests.

### `contracts/cinder/`
- `src/main.sw` — Cinder token logic.
- `src/events.sw` — token events.
- `src/structs.sw` — token-specific structs (if any).
- `tests/harness.rs` — integration tests.

### `contracts/libs/types/`
Shared types and ABI definitions used across contracts:
- `structs.sw` — shared structs (TokenInfo, Pledge, etc).
- `campaign.sw` — Campaign + CampaignStatus.
- `bonding.sw` — BondingCurve model and pricing helpers.
- `launchpad.sw` — Launchpad ABI.
- `cinder.sw` — CinderToken ABI.

### `contracts/libs/utils/`
- `utils.sw` — shared helper functions (if any).

