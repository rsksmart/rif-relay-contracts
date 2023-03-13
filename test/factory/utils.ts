import { constants } from 'ethers';
import {
  EnvelopingTypes,
  IForwarder,
} from 'typechain-types/contracts/RelayHub';

export function createDeployRequest(
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
