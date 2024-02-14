import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getVerifiersFromArgs, getVerifiersFromFile } from '../utils';
import { DestinationContractHandler } from 'typechain-types';

export type GetAllowedContractsArgs = {
  verifierList?: string;
};

export const getAllowedContracts = async (
  { verifierList }: GetAllowedContractsArgs,
  hre: HardhatRuntimeEnvironment
) => {
  const verifiers: DestinationContractHandler[] = verifierList
    ? await getVerifiersFromArgs(verifierList, hre, 'Contract')
    : await getVerifiersFromFile(hre, 'Contract');

  for (const verifier of verifiers) {
    try {
      const allowedContracts = await verifier.getAcceptedContracts();
      console.log(
        `Verifier: ${verifier.address}, allowedContracts `,
        allowedContracts
      );
    } catch (error) {
      console.error(
        `Error getting allowed contracts for verifier at ${verifier.address}`
      );
      throw error;
    }
  }
};
