import fs from 'fs';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AddressesConfig } from './deploy';


// TODO: we may convert this function to return a promise
export const parseJsonFile = <T>(filePath: string) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf-8' })) as T;
  }
  throw new Error(`The file ${filePath} doesn't exist`);
};


export const getExistingConfig = (addressFile: string): AddressesConfig | undefined => {
  try {
    return parseJsonFile<AddressesConfig>(addressFile);
  } catch (error) {
    console.warn(error);
  }

  return undefined;
};

export async function getVerifiers(hre: HardhatRuntimeEnvironment) {
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
      'Could not obtain native deploy verifier address for the NativeHolderSmartWallet'
    );
  }

  if (!nativeRelayVerifierAddress) {
    throw new Error(
      'Could not obtain native relay verifier address for the NativeHolderSmartWallet'
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

  return {
    deployVerifier,
    relayVerifier,
    customDeployVerifier,
    customRelayVerifier,
    nativeHolderDeployVerifier,
    nativeHolderRelayVerifier,
  };
}
