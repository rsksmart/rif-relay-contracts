import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TokenHandler } from 'typechain-types';
import { getVerifiers } from './utils';

export type AllowedTokensArgs = {
  verifierList?: string
}

const getVerifiersFromFile = async (hre: HardhatRuntimeEnvironment) => {
  const {
    deployVerifier,
    relayVerifier,
    customDeployVerifier,
    customRelayVerifier,
    nativeHolderDeployVerifier,
    nativeHolderRelayVerifier,
  } = await getVerifiers(hre);

  return [
    deployVerifier,
    relayVerifier,
    customDeployVerifier,
    customRelayVerifier,
    nativeHolderDeployVerifier,
    nativeHolderRelayVerifier
  ] as TokenHandler[];
};

const getTokenHandlerFromAddress = async (address: string, { ethers }: HardhatRuntimeEnvironment): Promise<TokenHandler> => await ethers.getContractAt(
  'TokenHandler',
  address
);

const getVerifiersFromArgs = async (verifierList: string, hre: HardhatRuntimeEnvironment) => Promise.all(verifierList.split(',').map((address) => getTokenHandlerFromAddress(address, hre)))

export const getAllowedTokens = async ({ verifierList }: AllowedTokensArgs, hre: HardhatRuntimeEnvironment) => {
  console.log('verifierList', verifierList);

  const verifiers = verifierList ? await getVerifiersFromArgs(verifierList, hre) : await getVerifiersFromFile(hre);

  for (const verifier of verifiers) {
    try {
      const allowedTokens = await verifier.getAcceptedTokens();
      console.log(`Verifier: ${verifier.address}, allowedTokens `, allowedTokens);
    } catch (error) {
      console.error(`Error getting allowed tokens for verifier at ${verifier.address}`);
      throw error;
    }
  }
};
