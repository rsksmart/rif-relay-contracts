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
  const contractAddressesDeployed = contractAddresses[networkChainKey];

  if (!contractAddressesDeployed) {
    throw new Error(`Contracts not deployed for chain ID ${chainId}`);
  }

  const deployVerifierAddress = contractAddressesDeployed.DeployVerifier;
  const relayVerifierAddress = contractAddressesDeployed.RelayVerifier;
  const customDeployVerifierAddress =
    contractAddressesDeployed.CustomSmartWalletDeployVerifier;
  const customRelayVerifierAddress =
    contractAddressesDeployed.CustomSmartWalletRelayVerifier;
  const nativeDeployVerifierAddress =
    contractAddressesDeployed.NativeHolderSmartWalletDeployVerifier;
  const nativeRelayVerifierAddress =
    contractAddressesDeployed.NativeHolderSmartWalletRelayVerifier;

  // TODO: This need to be refactored
  if (!deployVerifierAddress) {
    throw new Error('Could not obtain deploy verifier address');
  }

  if (!relayVerifierAddress) {
    throw new Error('Could not obtain relay verifier address');
  }

  if (!customDeployVerifierAddress) {
    throw new Error('Could not obtain custom deploy verifier address');
  }

  if (!customRelayVerifierAddress) {
    throw new Error('Could not obtain custom deploy verifier address');
  }

  if (!nativeDeployVerifierAddress) {
    throw new Error(
      'Could not obtain deploy verifier address for the NativeHolderSmartWallet'
    );
  }

  if (!nativeRelayVerifierAddress) {
    throw new Error(
      'Could not obtain relay verifier address for the NativeHolderSmartWallet'
    );
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

  const customRelayVerifier = await ethers.getContractAt(
    'RelayVerifier',
    customRelayVerifierAddress
  );

  const nativeHolderDeployVerifier = await ethers.getContractAt(
    'DeployVerifier',
    nativeDeployVerifierAddress
  );
  const nativeHolderRelayVerifier = await ethers.getContractAt(
    'RelayVerifier',
    nativeRelayVerifierAddress
  );

  const verifierMap: Map<
    string,
    { acceptToken: (tokenAddress: string) => Promise<ContractTransaction> }
  > = new Map();
  verifierMap.set('deployVerifier', deployVerifier);
  verifierMap.set('relayVerifier', relayVerifier);
  verifierMap.set('customDeployVerifier', customDeployVerifier);
  verifierMap.set('customRelayVerifier', customRelayVerifier);
  verifierMap.set('nativeHolderDeployVerifier', nativeHolderDeployVerifier);
  verifierMap.set('nativeHolderRelayVerifier', nativeHolderRelayVerifier);

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
