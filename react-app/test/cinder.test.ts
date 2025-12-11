import { describe, test, expect } from 'vitest';
import { Cinder } from '../src/sway-api/contracts/Cinder';
import { CinderFactory } from '../src/sway-api/contracts/CinderFactory';
import { Provider, Wallet } from 'fuels';

describe("test cinder", () => {
  // test("test cinder", async () => {
  //   // Подключаемся к локальной ноде
  //   const LOCAL_NODE_URL = 'http://127.0.0.1:4100/v1/graphql';
  //   const provider = new Provider(LOCAL_NODE_URL);
    
  //   // Создаём кошелёк из приватного ключа
  //   // Можно использовать дефолтный тестовый ключ из fuel-core
  //   const PRIVATE_KEY = '0xde97d8624a438121b86a1956544bd72ed68cd69f2c99555b08b1e8c51ffd511c';
  //   const wallet = Wallet.fromPrivateKey(PRIVATE_KEY, provider);
    
  //   console.log("wallet address", wallet.address.toString());
  //   console.log("balance", await wallet.getBalance());
    
  //   // Вариант 1: Деплоим новый контракт
  //   const factory = new CinderFactory(wallet);
  //   const { waitForResult } = await factory.deploy();
  //   const { contract } = await waitForResult();
    
  //   console.log("contract id", contract.id.toString());
    
  //   // Инициализируем контракт
  //   const identity = { Address: { bits: wallet.address.toB256() } };
  //   await contract.functions.initialize(identity).call();
    
  //   // Вызываем методы
  //   const { value: totalAssets } = await contract.functions.total_assets().get();
  //   console.log("total assets", totalAssets.toString());
    
  //   expect(totalAssets.toString()).toBe('1');
  // });
  
  test("подключение к существующему контракту", async () => {
    // Подключаемся к ноде
    const provider = new Provider('http://127.0.0.1:4100/v1/graphql');
    const wallet = Wallet.fromPrivateKey(
      '0xde97d8624a438121b86a1956544bd72ed68cd69f2c99555b08b1e8c51ffd511c',
      provider
    );
    
    // Вариант 2: Подключаемся к уже задеплоенному контракту
    const CONTRACT_ID = '0x...'; // Адрес вашего контракта
    const contract = new Cinder(CONTRACT_ID, wallet);
    
    // Сразу вызываем методы (контракт уже инициализирован)
    const { value: totalAssets } = await contract.functions.total_assets().get();
    console.log("total assets", totalAssets.toString());
    
    expect(totalAssets).toBeDefined();
  });
});