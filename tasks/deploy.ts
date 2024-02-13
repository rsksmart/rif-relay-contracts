import { HardhatEthersHelpers, HardhatRuntimeEnvironment } from 'hardhat/types';
import fs from 'node:fs';
import { ContractAddresses, NetworkConfig } from '../utils/scripts/types';
import { parseJsonFile } from './utils';

const ADDRESS_FILE = process.env['ADDRESS_FILE'] || 'contract-addresses.json';

export type AddressesConfig = { [key: string]: ContractAddresses };

export type DeployArg = {
  relayHub?: boolean;
  /* penalizer?: boolean;
  smartWallet?: boolean;
  customSmartWallet?: boolean;
  nativeHolderSmartWallet?: boolean;
  boltzSmartWallet?: boolean;
  minimalBoltzSmartWallet?: boolean;
  utilToken?: boolean; */
};

// TODO: Use the async version of fs.writeFile
export const writeConfigToDisk = (config: NetworkConfig) => {
  fs.writeFileSync(ADDRESS_FILE, JSON.stringify(config));
  console.log(`Address file available at: "${ADDRESS_FILE}"`);
};

export const updateConfig = async (
  contractAddresses: ContractAddresses,
  { hardhatArguments, config: { networks } }: HardhatRuntimeEnvironment
): Promise<NetworkConfig> => {
  console.log('Generating network config...');

  const { network } = hardhatArguments;
  if (!network) {
    throw new Error('Unknown Network');
  }
  const networkConfig = networks[network];
  if (!networkConfig) {
    throw new Error(`No network configuration found for ${network}`);
  }
  const { chainId } = networkConfig;

  if (!chainId) {
    throw new Error('Unknown Chain Id');
  }

  const existingConfig = (await new Promise<AddressesConfig>((resolve) => {
    resolve(parseJsonFile<AddressesConfig>(ADDRESS_FILE));
  }).catch(() =>
    console.log(`Previous configuration not found at: "${ADDRESS_FILE}"`)
  )) as AddressesConfig;

  return {
    ...existingConfig,
    [`${network}.${chainId}`]: contractAddresses,
  };
};

export const deployContracts = async (
  deployArg: DeployArg,
  ethers: HardhatEthersHelpers,
  networkName?: string
): Promise<ContractAddresses> => {
  console.log({ deployArg });
  if (Object.values(deployArg).every((v) => v === false)) {
    // if no arguments are specified, we deploy everything
    const relayHubF = await ethers.getContractFactory('RelayHub');
    const penalizerF = await ethers.getContractFactory('Penalizer');
    const smartWalletF = await ethers.getContractFactory('SmartWallet');
    const smartWalletFactoryF = await ethers.getContractFactory(
      'SmartWalletFactory'
    );
    const deployVerifierF = await ethers.getContractFactory('DeployVerifier');
    const relayVerifierF = await ethers.getContractFactory('RelayVerifier');

    const customSmartWalletF = await ethers.getContractFactory(
      'CustomSmartWallet'
    );
    const customSmartWalletFactoryF = await ethers.getContractFactory(
      'CustomSmartWalletFactory'
    );
    const customSmartWalletDeployVerifierF = await ethers.getContractFactory(
      'CustomSmartWalletDeployVerifier'
    );
    const nativeHolderSmartWalletF = await ethers.getContractFactory(
      'NativeHolderSmartWallet'
    );

    const boltzSmartWalletF = await ethers.getContractFactory('BoltzSmartWallet');
    const boltzSmartWalletFactoryF = await ethers.getContractFactory(
      'BoltzSmartWalletFactory'
    );
    const boltzDeployVerifierF = await ethers.getContractFactory(
      'BoltzDeployVerifier'
    );
    const boltzRelayVerifierF = await ethers.getContractFactory(
      'BoltzRelayVerifier'
    );

    const minimalBoltzDeployVerifierF = await ethers.getContractFactory(
      'MinimalBoltzDeployVerifier'
    );
    const minimalBoltzRelayVerifierF = await ethers.getContractFactory(
      'MinimalBoltzRelayVerifier'
    );

    const versionRegistryFactory = await ethers.getContractFactory(
      'VersionRegistry'
    );

    const { address: penalizerAddress } = await penalizerF.deploy();
    const { address: relayHubAddress } = await relayHubF.deploy(
      penalizerAddress,
      1,
      1,
      1,
      1
    );
    const { address: smartWalletAddress } = await smartWalletF.deploy();
    const { address: smartWalletFactoryAddress } =
      await smartWalletFactoryF.deploy(smartWalletAddress);
    const { address: deployVerifierAddress } = await deployVerifierF.deploy(
      smartWalletFactoryAddress
    );
    const { address: relayVerifierAddress } = await relayVerifierF.deploy(
      smartWalletFactoryAddress
    );

    const { address: customSmartWalletAddress } =
      await customSmartWalletF.deploy();
    const { address: customSmartWalletFactoryAddress } =
      await customSmartWalletFactoryF.deploy(customSmartWalletAddress);
    const { address: customDeployVerifierAddress } =
      await customSmartWalletDeployVerifierF.deploy(
        customSmartWalletFactoryAddress
      );
    const { address: customRelayVerifierAddress } = await relayVerifierF.deploy(
      customSmartWalletFactoryAddress
    );

    const { address: nativeHolderSmartWalletAddress } =
      await nativeHolderSmartWalletF.deploy();
    const { address: nativeHolderSmartWalletFactoryAddress } =
      await smartWalletFactoryF.deploy(nativeHolderSmartWalletAddress);
    const { address: nativeDeployVerifierAddress } = await deployVerifierF.deploy(
      nativeHolderSmartWalletFactoryAddress
    );
    const { address: nativeRelayVerifierAddress } = await relayVerifierF.deploy(
      nativeHolderSmartWalletFactoryAddress
    );

    const { address: boltzSmartWalletAddress } = await boltzSmartWalletF.deploy();
    const { address: boltzSmartWalletFactoryAddress } =
      await boltzSmartWalletFactoryF.deploy(boltzSmartWalletAddress);
    const { address: boltzDeployVerifierAddress } =
      await boltzDeployVerifierF.deploy(boltzSmartWalletFactoryAddress);
    const { address: boltzRelayVerifierAddress } =
      await boltzRelayVerifierF.deploy(boltzSmartWalletFactoryAddress);

    const { address: minimalBoltzDeployVerifierAddress } =
      await minimalBoltzDeployVerifierF.deploy(boltzSmartWalletFactoryAddress);
    const { address: minimalBoltzRelayVerifierAddress } =
      await minimalBoltzRelayVerifierF.deploy(boltzSmartWalletFactoryAddress);

    const { address: minimalBoltzsmartWalletAddress } =
      await smartWalletF.deploy();
    const { address: minimalBoltzsmartWalletFactoryAddress } =
      await smartWalletFactoryF.deploy(smartWalletAddress);

    const { address: versionRegistryAddress } =
      await versionRegistryFactory.deploy();

    let utilTokenAddress;
    if (networkName != 'mainnet') {
      const utilTokenF = await ethers.getContractFactory('UtilToken');
      const { address } = await utilTokenF.deploy();
      utilTokenAddress = address;
    }

    return {
      Penalizer: penalizerAddress,
      RelayHub: relayHubAddress,
      SmartWallet: smartWalletAddress,
      SmartWalletFactory: smartWalletFactoryAddress,
      DeployVerifier: deployVerifierAddress,
      RelayVerifier: relayVerifierAddress,
      CustomSmartWallet: customSmartWalletAddress,
      CustomSmartWalletFactory: customSmartWalletFactoryAddress,
      CustomSmartWalletDeployVerifier: customDeployVerifierAddress,
      CustomSmartWalletRelayVerifier: customRelayVerifierAddress,
      NativeHolderSmartWallet: nativeHolderSmartWalletAddress,
      NativeHolderSmartWalletFactory: nativeHolderSmartWalletFactoryAddress,
      NativeHolderSmartWalletDeployVerifier: nativeDeployVerifierAddress,
      NativeHolderSmartWalletRelayVerifier: nativeRelayVerifierAddress,
      BoltzSmartWallet: boltzSmartWalletAddress,
      BoltzSmartWalletFactory: boltzSmartWalletFactoryAddress,
      BoltzDeployVerifier: boltzDeployVerifierAddress,
      BoltzRelayVerifier: boltzRelayVerifierAddress,
      MinimalBoltzSmartWallet: minimalBoltzsmartWalletAddress,
      MinimalBoltzSmartWalletFactory: minimalBoltzsmartWalletFactoryAddress,
      MinimalBoltzDeployVerifier: minimalBoltzDeployVerifierAddress,
      MinimalBoltzRelayVerifier: minimalBoltzRelayVerifierAddress,
      UtilToken: utilTokenAddress,
      VersionRegistry: versionRegistryAddress,
    };
  }
  // deploy only the contracts specified through the flags

  return {} as ContractAddresses;
};

export const deploy = async (deployArg: DeployArg, hre: HardhatRuntimeEnvironment) => {
  const {
    ethers,
    hardhatArguments: { network },
  } = hre;
  const contractAddresses = await deployContracts(deployArg, ethers, network);
  console.table(contractAddresses);
  const newConfig = await updateConfig(contractAddresses, hre);
  writeConfigToDisk(newConfig);
};
