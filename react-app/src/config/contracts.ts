import { environment as appEnvironment } from '../lib';

export type DappEnvironment = 'local' | 'testnet' | 'mainnet';

export type ContractIds = {
  CINDER: string;
  LAUNCHPAD: string;
  AMM: string;
};

const env = (appEnvironment ?? 'local') as DappEnvironment;

const TESTNET: ContractIds = {
  CINDER: '0x115267bb2105aaac59cc04955c5995779f9eeb0fac2f8dafe521ec88b97fc7a2',
  LAUNCHPAD: '0x662cbc18c3548deb39a636a2de037e3eea570208a4de3f092065663a1e7db170',
  AMM: '0x55e8ddcf8c654f1d211e980a2437af0be1ea47ef878ec77fb70d7c82afa21fcf',
};

// Заполни, когда будут mainnet-деплои.
const MAINNET: ContractIds = {
  CINDER: '',
  LAUNCHPAD: '',
  AMM: '',
};

type LocalRegistry = {
  contracts: Record<string, { contract_id: string }>;
};

let cache: Promise<ContractIds> | null = null;

function assertNonEmpty(ids: ContractIds, hint: string) {
  const empty = Object.entries(ids).filter(([, v]) => !v);
  if (empty.length === 0) return;
  const keys = empty.map(([k]) => k).join(', ');
  throw new Error(`${hint}: пустые contract id для ${keys}`);
}

async function loadLocalFromPublicJson(): Promise<ContractIds> {
  const res = await fetch('/fuel-contracts.local.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(
      'Не найден /fuel-contracts.local.json. Запусти ./scripts/deploy_contracts.sh (он пишет в react-app/public).'
    );
  }

  const json = (await res.json()) as LocalRegistry;

  const get = (name: 'cinder' | 'launchpad' | 'amm') => {
    const id = json.contracts?.[name]?.contract_id;
    if (!id) throw new Error(`В registry нет contract_id для "${name}"`);
    return id;
  };

  return {
    CINDER: get('cinder'),
    LAUNCHPAD: get('launchpad'),
    AMM: get('amm'),
  };
}

export function getContracts(): Promise<ContractIds> {
  if (cache) return cache;

  cache = (async () => {
    if (env === 'local') return await loadLocalFromPublicJson();
    if (env === 'testnet') return TESTNET;
    if (env === 'mainnet') {
      assertNonEmpty(MAINNET, 'MAINNET адреса не заполнены');
      return MAINNET;
    }
    throw new Error(`Неизвестное окружение: ${env}`);
  })();

  return cache;
}