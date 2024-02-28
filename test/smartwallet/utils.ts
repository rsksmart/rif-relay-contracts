import { TypedDataUtils, SignTypedDataVersion } from '@metamask/eth-sig-util';
import { ethers } from 'hardhat';
import { IForwarder } from '../../typechain-types/contracts/RelayHub';
import { EnvelopingTypes } from '../../typechain-types/contracts/RelayHub';
import { DeployRequest, TypedRequestData } from '../utils/EIP712Utils';

const ZERO_ADDRESS = ethers.constants.AddressZero;
export const HARDHAT_CHAIN_ID = 31337;
const ONE_FIELD_IN_BYTES = 32;

export type ForwardRequest = IForwarder.ForwardRequestStruct;
export type RelayRequest = EnvelopingTypes.RelayRequestStruct;
export type RelayData = EnvelopingTypes.RelayDataStruct;
export type DeployRequestInternal = IForwarder.DeployRequestStruct;

export function createDeployRequest(
  request: Partial<DeployRequestInternal>,
  relayData?: Partial<RelayData>
): DeployRequest {
  const baseRequest = {
    request: {
      relayHub: ZERO_ADDRESS,
      from: ZERO_ADDRESS,
      to: ZERO_ADDRESS,
      tokenContract: ZERO_ADDRESS,
      recoverer: ZERO_ADDRESS,
      value: '0',
      nonce: '0',
      tokenAmount: '0',
      tokenGas: '50000',
      index: '0',
      validUntilTime: '0',
      data: '0x',
    },
    relayData: {
      gasPrice: '1',
      feesReceiver: ZERO_ADDRESS,
      callForwarder: ZERO_ADDRESS,
      callVerifier: ZERO_ADDRESS,
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

export function createRelayRequest(
  request: Partial<ForwardRequest>,
  relayData?: Partial<RelayData>
): RelayRequest {
  const baseRequest: RelayRequest = {
    request: {
      relayHub: ZERO_ADDRESS,
      from: ZERO_ADDRESS,
      to: ZERO_ADDRESS,
      tokenContract: ZERO_ADDRESS,
      value: '0',
      gas: '10000',
      nonce: '0',
      tokenAmount: '0',
      tokenGas: '50000',
      validUntilTime: '0',
      data: '0x',
    },
    relayData: {
      gasPrice: '1',
      feesReceiver: ZERO_ADDRESS,
      callForwarder: ZERO_ADDRESS,
      callVerifier: ZERO_ADDRESS,
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

export function getSuffixData(typedRequestData: TypedRequestData): string {
  const encoded = TypedDataUtils.encodeData(
    typedRequestData.primaryType,
    typedRequestData.message,
    typedRequestData.types,
    SignTypedDataVersion.V4
  );

  const messageSize = Object.keys(typedRequestData.message).length;

  return '0x' + encoded.slice(messageSize * ONE_FIELD_IN_BYTES).toString('hex');
}

export function buildDomainSeparator(address: string) {
  const domainSeparator = {
    name: 'RSK Enveloping Transaction',
    version: '2',
    chainId: HARDHAT_CHAIN_ID,
    verifyingContract: address,
  };

  return ethers.utils._TypedDataEncoder.hashDomain(domainSeparator);
}
