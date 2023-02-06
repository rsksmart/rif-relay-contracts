import { ethers } from 'hardhat';

const PERSONAL_SIGN_PREFIX = '\x19Ethereum Signed Message:\n';
const stringOrEmpty = (str: string | null) => str ?? '';

export const createValidPersonalSignSignature = (
  ownerPrivateKey: Buffer,
  msg: string | null
) => {
  const message = stringOrEmpty(msg);
  const byteMessage = ethers.utils.arrayify(ethers.utils.hexlify(message));
  const toSign = stringOrEmpty(
    ethers.utils.solidityKeccak256(
      ['string', 'bytes32'],
      [`${PERSONAL_SIGN_PREFIX}${byteMessage.length}`, message]
    )
  );

  const toSignAsBinaryArray = ethers.utils.arrayify(toSign);
  const signingKey = new ethers.utils.SigningKey(ownerPrivateKey);
  const signature = signingKey.signDigest(toSignAsBinaryArray);
  const signatureCollapsed = ethers.utils.joinSignature(signature);

  return signatureCollapsed;
};
