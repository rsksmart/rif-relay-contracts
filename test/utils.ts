import RelayHubConfiguration from '../types/RelayHubConfiguration';

export function generateBytes32(seed: number): string {
    return '0x' + seed.toString().repeat(64).slice(0, 64);
}

export interface Environment {
    readonly chainId: number;
    readonly mintxgascost: number;
    readonly relayHubConfiguration: RelayHubConfiguration;
}

const defaultRelayHubConfiguration: RelayHubConfiguration = {
    maxWorkerCount: 10,
    minimumStake: (1e18).toString(),
    minimumUnstakeDelay: 1000,
    minimumEntryDepositValue: (1e18).toString()
};

export const environments: { [key: string]: Environment } = {
    istanbul: {
        chainId: 1,
        relayHubConfiguration: defaultRelayHubConfiguration,
        mintxgascost: 21000
    },
    constantinople: {
        chainId: 1,
        relayHubConfiguration: defaultRelayHubConfiguration,
        mintxgascost: 21000
    },
    rsk: {
        chainId: 33,
        relayHubConfiguration: defaultRelayHubConfiguration,
        mintxgascost: 21000
    }
};

export const defaultEnvironment = environments.rsk;

export async function getTestingEnvironment(): Promise<Environment> {
    const networkId = await web3.eth.net.getId();
    return networkId === 33 ? environments.rsk : defaultEnvironment;
}

/**
 * Get a Map from topics to their corresponding event's ABI
 */
function getEventsAbiByTopic(abi: any): Map<string, any> {
    const eventsAbiByTopic = new Map<string, any>();
    // @ts-ignore
    const logicEvents = abi.filter((elem) => elem.type === 'event');
    // @ts-ignore
    logicEvents.forEach((abi) => {
        eventsAbiByTopic.set(abi.signature, abi);
    });
    return eventsAbiByTopic;
}

/**
 * Decodes events which satisfies an ABI specification
 */
export function containsEvent(
    abi: any,
    rawLogs: any,
    eventName: string
): boolean {
    const eventsAbiByTopic = getEventsAbiByTopic(abi);
    // @ts-ignore
    return rawLogs.some(
        (log) =>
            eventsAbiByTopic.has(log.topics[0]) &&
            eventsAbiByTopic.get(log.topics[0]).name === eventName
    );
}
