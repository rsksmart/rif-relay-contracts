
export async function getTestingEnvironment(): Promise<Environment> {
    const networkId = await web3.eth.net.getId();
    return networkId === 33 ? environments.rsk : defaultEnvironment;
}

export interface Environment {
    readonly chainId: number;
    readonly mintxgascost: number;
    readonly relayHubConfiguration: RelayHubConfiguration;
}

export declare const environments: {
    [key: string]: Environment;
};

export declare const defaultEnvironment: Environment;

export declare function getEnvironment(networkName: string): Environment;

export declare function isRsk(environment: Environment): boolean;

export interface RelayHubConfiguration {
    maxWorkerCount: number;
    minimumUnstakeDelay: number;
    minimumStake: string;
    minimumEntryDepositValue: string;
}
