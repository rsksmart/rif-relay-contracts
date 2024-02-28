import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { GetAllowedContractsArgs } from './getAllowedContracts';
import { getVerifiersFromArgs, getVerifiersFromFile } from '../utils';
import { DestinationContractHandler } from 'typechain-types';

export type AllowedContractsArgs = GetAllowedContractsArgs & {
  contractList: string;
};

export const allowContracts = async (
  { contractList, verifierList }: AllowedContractsArgs,
  hre: HardhatRuntimeEnvironment
) => {
  const contractAddresses = contractList.split(',');

  const verifiers: DestinationContractHandler[] = verifierList
    ? await getVerifiersFromArgs(verifierList, hre, 'Contract')
    : await getVerifiersFromFile(hre, 'Contract');

  for (const contractAddress of contractAddresses) {
    for (const verifier of verifiers) {
      try {
        const tx = await verifier.acceptContract(contractAddress);
        console.log(`Sent transaction ${tx.hash}`);
      } catch (error) {
        console.error(
          `Error adding contract with address ${contractAddress} to allowed contracts on Verifier at ${verifier.address}`
        );
        throw error;
      }
    }
  }
};
