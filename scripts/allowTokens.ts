import { ContractTransaction } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getExistingConfig } from './deploy';

export const allowTokens = async (
  taskArgs: { tokenlist: string },
  hre: HardhatRuntimeEnvironment
) => {
  const tokenAddresses = taskArgs.tokenlist.split(',');

  const { ethers, network } = hre;

  if (!network) {
    throw new Error('Unknown Network');
  }

  const { chainId } = network.config;

  if (!chainId) {
    throw new Error('Unknown Chain Id');
  }

  const contractAddresses = getExistingConfig();

  if (!contractAddresses) {
    throw new Error('No contracts deployed');
  }

  const networkChainKey = `${network.name}.${chainId}`;

  const deployVerifierAddress =
    contractAddresses[networkChainKey].DeployVerifier;
  const relayVerifierAddress = contractAddresses[networkChainKey].RelayVerifier;
  const customDeployVerifierAddress =
    contractAddresses[networkChainKey].CustomSmartWalletDeployVerifier;

  if (!deployVerifierAddress) {
    throw new Error('Could not obtain deploy verifier address');
  }

  if (!relayVerifierAddress) {
    throw new Error('Could not obtain relay verifier address');
  }

  if (!customDeployVerifierAddress) {
    throw new Error('Could not obtain custom deploy verifier address');
  }

  const deployVerifier = await ethers.getContractAt(
    'DeployVerifier',
    deployVerifierAddress
  );
  const relayVerifier = await ethers.getContractAt(
    'RelayVerifier',
    relayVerifierAddress
  );
  const customDeployVerifier = await ethers.getContractAt(
    'CustomSmartWalletDeployVerifier',
    customDeployVerifierAddress
  );

  const verifierMap: Map<
    string,
    { acceptToken: (tokenAddress: string) => Promise<ContractTransaction> }
  > = new Map();
  verifierMap.set('deployVerifier', deployVerifier);
  verifierMap.set('relayVerifier', relayVerifier);
  verifierMap.set('customDeployVerifier', customDeployVerifier);

  for (const tokenAddress of tokenAddresses) {
    for (const [key, verifier] of verifierMap) {
      try {
        await verifier.acceptToken(tokenAddress);
      } catch (error) {
        console.error(
          `Error adding token with address ${tokenAddress} to allowed tokens on ${key}`
        );
        throw error;
      }
    }
  }
  console.log('Tokens allowed successfully!');
};
