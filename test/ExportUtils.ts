import { PrefixedHexString } from 'ethereumjs-tx';
import { bufferToHex } from 'ethereumjs-util';
import { TypedDataUtils } from 'eth-sig-util';

export interface EIP712Domain {
    name?: string;
    version?: string;
    chainId?: string | number;
    verifyingContract?: string;
    salt?: string;
}

export const EIP712DomainType = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' }
];

// export declare function getDomainSeparator(verifyingContract: string, chainId: number): EIP712Domain;
// export declare function getDomainSeparatorHash(verifier: string, chainId: number): PrefixedHexString;
export const DomainSeparatorType = {
    prefix: 'string name,string version',
    name: 'RSK Enveloping Transaction',
    version: '2'
};

export function getDomainSeparator(
    verifyingContract: string,
    chainId: number
): EIP712Domain {
    return {
        name: DomainSeparatorType.name,
        version: DomainSeparatorType.version,
        chainId: chainId,
        verifyingContract: verifyingContract
    };
}

export function getDomainSeparatorHash(
    verifier: string,
    chainId: number
): PrefixedHexString {
    return bufferToHex(
        TypedDataUtils.hashStruct(
            'EIP712Domain',
            getDomainSeparator(verifier, chainId),
            { EIP712Domain: EIP712DomainType }
        )
    );
}
