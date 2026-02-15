import { environment as appEnvironment } from '../lib';

export type DappEnvironment = 'local' | 'testnet' | 'mainnet';

export type ContractIds = {
  CINDER: string;
  LAUNCHPAD: string;
  FUEL: string;
};

const env = (appEnvironment ?? 'local') as DappEnvironment;

const TESTNET: ContractIds = {
  CINDER: '0x4214e6Fc579b26D42bf87d77e0F58a027905050503D361Ab4cfdCD74f69f4042',
  LAUNCHPAD: '0x732a37e72cb2664ac09cdde172c722745b9e7e201f34e76eb6471fb561c6bbf2',
  FUEL: '0x3b3e04f181faba12392a348cd8ad9363af0e5e23dc44ef66a316e90dde7a5ca5',
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