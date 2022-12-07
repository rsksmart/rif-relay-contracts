import { PrefixedHexString } from 'ethereumjs-tx';

export interface ForwardRequest {
    relayHub: string;
    from: string;
    to: string;
    tokenContract: string;
    value: string;
    gas: string;
    nonce: string;
    tokenAmount: string;
    tokenGas: string;
    validUntilTime: string;
    data: PrefixedHexString;
}

export interface DeployRequestStruct {
    relayHub: string;
    from: string;
    to: string;
    tokenContract: string;
    recoverer: string;
    value: string;
    nonce: string;
    tokenAmount: string;
    tokenGas: string;
    index: string;
    validUntilTime: string;
    data: PrefixedHexString;
}
