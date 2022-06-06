import { PrefixedHexString } from 'ethereumjs-tx';

export interface EIP712Domain {
    name?: string;
    version?: string;
    chainId?: string | number;
    verifyingContract?: string;
    salt?: string;
}

export declare function getDomainSeparator(verifyingContract: string, chainId: number): EIP712Domain;
export declare function getDomainSeparatorHash(verifier: string, chainId: number): PrefixedHexString;