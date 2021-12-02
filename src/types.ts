export interface NetworkSpecificConfigs {
    rpcUrl: string;
    networkId: number;
    chainId: number;
}

export interface APIConfig {
    apiUrl?: string
    apiKey?: string
}

export interface HistoryTransaction {
    hash: string | undefined,
    from_address: string | undefined,
    to_address: string | undefined,
    amount: number| undefined,
    amount_sing: number| undefined,
    price_sing: number| undefined,
    payment_method: string | undefined,
    network_id: number| undefined,
    created_at?: string,
}
export interface HistoryTransfer {
    hash: string | undefined,
    from_address: string | undefined,
    to_address: string | undefined,
    amount: number| undefined,
    network_id: number| undefined,
    created_at?: string,
}
export interface SmartContractInterface {
    sing_rate: number,
    time_lock: number,
    name: string,
    address: string,
    start_date: string,
    end_date: string,
    network_id: number,
    term: string
}

export interface LockedItemInterface {
    amountLockIndex: number,
    releaseDate: number,
}