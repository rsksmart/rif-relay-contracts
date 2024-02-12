import { constants, Wallet } from 'ethers';
import seedrandom from 'seedrandom';
import { getSuffixData } from '../smartwallet/utils';
import {
  getLocalEip712DeploySignature,
  TypedDeployRequestData,
} from '../utils/EIP712Utils';

import {
  EnvelopingTypes,
  IForwarder,
} from 'typechain-types/contracts/RelayHub';

const random = seedrandom('rif');
const minIndex = 0;
const maxIndex = 1000000000;

const randomNumber = (min = minIndex, max = maxIndex) =>
  Math.floor(random() * (max - min + 1) + min);

function createDeployRequest(
  request: Partial<IForwarder.DeployRequestStruct>,
  relayData?: Partial<EnvelopingTypes.RelayDataStruct>
): EnvelopingTypes.DeployRequestStruct {
  const baseRequest: EnvelopingTypes.DeployRequestStruct = {
    request: {
      recoverer: constants.AddressZero,
      relayHub: constants.AddressZero,
      from: constants.AddressZero,
      to: constants.AddressZero,
      tokenContract: constants.AddressZero,
      value: '0',
      index: 0,
      nonce: '0',
      tokenAmount: '0',
      tokenGas: '50000',
      validUntilTime: '0',
      data: '0x',
    },
    relayData: {
      gasPrice: '1',
      feesReceiver: constants.AddressZero,
      callForwarder: constants.AddressZero,
      callVerifier: constants.AddressZero,
    },
  };

  return {
    request: {
      ...baseRequest.request,
      ...request,
    },
    relayData: {
      ...baseRequest.relayData,
      ...relayData,
    },
  };
}

const signDeployRequest = (
  signer: Wallet,
  deployRequest: EnvelopingTypes.DeployRequestStruct,
  verifier: string,
  chainId: number
) => {
  const typedDeployData = new TypedDeployRequestData(
    chainId,
    verifier,
    deployRequest
  );

  const suffixData = getSuffixData(typedDeployData);

  const privateKey = Buffer.from(signer.privateKey.substring(2, 66), 'hex');

  const signature = getLocalEip712DeploySignature(typedDeployData, privateKey);

  return {
    suffixData,
    signature,
  };
};

export { randomNumber, createDeployRequest, signDeployRequest };
