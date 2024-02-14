import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AllowedContractsArgs } from './allowContracts';
import { getVerifiersFromArgs, getVerifiersFromFile } from '../utils';
import { DestinationContractHandler } from 'typechain-types';

export const removeContracts = async (
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
        const index = (await verifier.getAcceptedContracts()).indexOf(
          contractAddress
        );
        if (index === -1) {
          console.log(
            `Contract with address ${contractAddress} is not accepted on Verifier at ${verifier.address}`
          );
          continue;
        }
        await verifier.removeContract(contractAddress, index);
      } catch (error) {
        console.error(
          `Error removing contract with address ${contractAddress} from allowed contracts on Verifier at ${verifier.address}`
        );
        throw error;
      }
    }
  }
  console.log('Contracts removed successfully!');
};
