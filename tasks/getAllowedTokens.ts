import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getExistingConfig } from './deploy';

export const getAllowedTokens = async (hre: HardhatRuntimeEnvironment) => {
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

  const verifierMap: Map<
    string,
    { getAcceptedTokens: () => Promise<string[]> }
  > = new Map();
  verifierMap.set('deployVerifier', deployVerifier);
  verifierMap.set('relayVerifier', relayVerifier);
  verifierMap.set('customDeployVerifier', customDeployVerifier);
  verifierMap.set('customRelayVerifier', customRelayVerifier);

  for (const [key, verifier] of verifierMap) {
    try {
      const allowedTokens = await verifier.getAcceptedTokens();
      console.log(key, allowedTokens);
    } catch (error) {
      console.error(`Error getting allowed tokens for ${key}`);
      throw error;
    }
  }
};
