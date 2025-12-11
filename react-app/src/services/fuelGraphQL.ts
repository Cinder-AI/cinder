// react-app/src/services/fuelGraphQL.ts

const FUEL_GRAPHQL_ENDPOINT = 'https://testnet.fuel.network/v1/graphql';

interface Balance {
  amount: string;
  assetId: string;
}

interface BalancesResponse {
  nodes: Balance[];
}

class FuelGraphQLService {
  private endpoint: string;

  constructor(endpoint: string = FUEL_GRAPHQL_ENDPOINT) {
    this.endpoint = endpoint;
  }

  /**
   * Выполняет GraphQL запрос
   */
  private async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const json = await response.json();
    
    if (json.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    return json.data;
  }

  /**
   * Получает балансы для указанного адреса
   */
  async getBalances(ownerAddress: string, limit: number = 20): Promise<Balance[]> {
    const query = `
      query Balances($filter: BalanceFilterInput, $first: Int) {
        balances(filter: $filter, first: $first) {
          nodes {
            amount
            assetId
          }
        }
      }
    `;

    const variables = {
      filter: { owner: ownerAddress },
      first: limit,
    };

    const result = await this.query<{ balances: BalancesResponse }>(query, variables);
    return result.balances.nodes;
  }

  /**
   * Получает баланс конкретного ассета
   */
  async getAssetBalance(ownerAddress: string, assetId: string): Promise<string | null> {
    const query = `
      query Balance($filter: BalanceFilterInput) {
        balances(filter: $filter, first: 1) {
          nodes {
            amount
            assetId
          }
        }
      }
    `;

    const variables = {
      filter: {
        owner: ownerAddress,
        assetId: assetId,
      },
    };

    const result = await this.query<{ balances: BalancesResponse }>(query, variables);
    return result.balances.nodes[0]?.amount || null;
  }

  /**
   * Получает информацию о транзакции (на будущее)
   */
  async getTransaction(txId: string) {
    const query = `
      query Transaction($id: TransactionId!) {
        transaction(id: $id) {
          id
          status {
            __typename
          }
        }
      }
    `;

    return this.query(query, { id: txId });
  }
}

// Экспортируем синглтон
export const fuelGraphQL = new FuelGraphQLService();

// Также экспортируем класс для создания кастомных инстансов
export { FuelGraphQLService };