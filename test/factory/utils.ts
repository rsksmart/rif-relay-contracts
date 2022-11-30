import { ethers } from 'ethers';

const PERSONAL_SIGN_PREFIX = '\x19Ethereum Signed Message:\n';

const stringOrEmpty = (str: string | null) => str ?? '';

export const createValidPersonalSignSignature = (
    ownerPrivateKey: Buffer,
    msg: string | null
) => {
    const message = stringOrEmpty(msg);
    const toSign = stringOrEmpty(
        web3.utils.soliditySha3(
            {
                t: 'string',
                v: PERSONAL_SIGN_PREFIX + web3.utils.hexToBytes(message).length
            },
            { t: 'bytes32', v: message }
        )
    );

    const toSignAsBinaryArray = ethers.utils.arrayify(toSign);
    const signingKey = new ethers.utils.SigningKey(ownerPrivateKey);
    const signature = signingKey.signDigest(toSignAsBinaryArray);
    const signatureCollapsed = ethers.utils.joinSignature(signature);

    return signatureCollapsed;
};
