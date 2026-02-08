import { environment as appEnvironment } from '../lib';

export type DappEnvironment = 'local' | 'testnet' | 'mainnet';

export type ContractIds = {
  CINDER: string;
  LAUNCHPAD: string;
  FUEL: string;
};

const env = (appEnvironment ?? 'local') as DappEnvironment;

const TESTNET: ContractIds = {
  CINDER: '0x4422903b2ebbd43b3ae32ad9b6d0802fa19ab88903d61b429d5771a36fa51286',
  LAUNCHPAD: '0x59d4475501eb74ebfc1afdf58ee7fb5d641dcbc5058f354bd99b4b61c93658f5',
  FUEL: '0xbff9e01a89b8563f453c3ca7a4e1ea0f87b90e48cd30df613978d4a4f0caaf4e',
};

// Заполни, когда будут mainnet-деплои.
const MAINNET: ContractIds = {
  CINDER: '',
  LAUNCHPAD: '',
  FUEL: '',
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

  const get = (name: 'cinder' | 'launchpad' | 'fuel') => {
    const id = json.contracts?.[name]?.contract_id;
    if (!id) throw new Error(`В registry нет contract_id для "${name}"`);
    return id;
  };

  return {
    CINDER: get('cinder'),
    LAUNCHPAD: get('launchpad'),
    FUEL: get('fuel'),
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