import { HardhatEthersHelpers, HardhatRuntimeEnvironment } from 'hardhat/types';
import fs from 'node:fs';
import { ContractAddresses, NetworkConfig } from '../utils/scripts/types';
import { parseJsonFile } from './utils';

const ADDRESS_FILE = process.env['ADDRESS_FILE'] || 'contract-addresses.json';

export type AddressesConfig = { [key: string]: ContractAddresses };

export type DeployArg = {
  relayHub?: boolean;
  defaulSmartWallet?: boolean;
  customSmartWallet?: boolean;
  nativeHolderSmartWallet?: boolean;
  utilToken?: boolean;
};

// TODO: Use the async version of fs.writeFile
export const writeConfigToDisk = (config: NetworkConfig) => {
  fs.writeFileSync(ADDRESS_FILE, JSON.stringify(config));
  console.log(`Address file available at: "${ADDRESS_FILE}"`);
};

export const updateConfig = async (
  contractAddresses: Partial<ContractAddresses>,
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

  const networkChainId = `${network}.${chainId}`;
  const existingNetworkConfig = (existingConfig || {})[networkChainId] || {};

  return {
    ...existingConfig,
    [networkChainId]: {
      ...existingNetworkConfig,
      ...contractAddresses,
    },
  };
};

export const deployContracts = async (
  deployArg: DeployArg,
  ethers: HardhatEthersHelpers,
  networkName?: string
): Promise<Partial<ContractAddresses>> => {
  if (Object.values(deployArg).every((v) => v === false)) {
    // if no arguments are specified, we deploy everything

    const { relayHubAddress, penalizerAddress } = await deployRelayHub(ethers);
    const {
      smartWalletAddress,
      smartWalletFactoryAddress,
      deployVerifierAddress,
      relayVerifierAddress,
    } = await deployDefaultSmartWallet(ethers);
    const {
      customSmartWalletFactoryAddress,
      customSmartWalletAddress,
      customDeployVerifierAddress,
      customRelayVerifierAddress,
    } = await deployCustomSmartWallet(ethers);
    const {
      nativeHolderSmartWalletAddress,
      nativeHolderSmartWalletFactoryAddress,
      nativeDeployVerifierAddress,
      nativeRelayVerifierAddress,
    } = await deployNativeHolderSmartWallet(ethers);

    const versionRegistryFactory = await ethers.getContractFactory(
      'VersionRegistry'
    );
    const { address: versionRegistryAddress } =
      await versionRegistryFactory.deploy();

    let utilTokenAddress;
    if (networkName != 'mainnet') {
      utilTokenAddress = await deployUtilToken(ethers);
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
      UtilToken: utilTokenAddress,
      // FIXME: to be removed
      VersionRegistry: versionRegistryAddress,
    };
  }

  // deploy only the contracts specified through the flags
  const {
    relayHub: relayHubFlag,
    defaulSmartWallet: defaultSmartWalletFlag,
    customSmartWallet: customSmartWalletFlag,
    nativeHolderSmartWallet: nativeHolderSmartWalletFlag,
    utilToken: utilTokenFlag,
  } = deployArg;
  let contractAddresses: Partial<ContractAddresses> = {};

  // TODO: refactor this to avoid ifs
  if (relayHubFlag) {
    const { relayHubAddress, penalizerAddress } = await deployRelayHub(ethers);
    contractAddresses = {
      ...contractAddresses,
      Penalizer: penalizerAddress,
      RelayHub: relayHubAddress,
    };
  }

  if (defaultSmartWalletFlag) {
    const {
      smartWalletAddress,
      smartWalletFactoryAddress,
      deployVerifierAddress,
      relayVerifierAddress,
    } = await deployDefaultSmartWallet(ethers);

    contractAddresses = {
      ...contractAddresses,
      SmartWallet: smartWalletAddress,
      SmartWalletFactory: smartWalletFactoryAddress,
      DeployVerifier: deployVerifierAddress,
      RelayVerifier: relayVerifierAddress,
    };
  }

  if (customSmartWalletFlag) {
    const {
      customSmartWalletFactoryAddress,
      customSmartWalletAddress,
      customDeployVerifierAddress,
      customRelayVerifierAddress,
    } = await deployCustomSmartWallet(ethers);
    contractAddresses = {
      ...contractAddresses,
      CustomSmartWallet: customSmartWalletAddress,
      CustomSmartWalletFactory: customSmartWalletFactoryAddress,
      CustomSmartWalletDeployVerifier: customDeployVerifierAddress,
      CustomSmartWalletRelayVerifier: customRelayVerifierAddress,
    };
  }

  if (nativeHolderSmartWalletFlag) {
    const {
      nativeHolderSmartWalletAddress,
      nativeHolderSmartWalletFactoryAddress,
      nativeDeployVerifierAddress,
      nativeRelayVerifierAddress,
    } = await deployNativeHolderSmartWallet(ethers);
    contractAddresses = {
      ...contractAddresses,
      NativeHolderSmartWallet: nativeHolderSmartWalletAddress,
      NativeHolderSmartWalletFactory: nativeHolderSmartWalletFactoryAddress,
      NativeHolderSmartWalletDeployVerifier: nativeDeployVerifierAddress,
      NativeHolderSmartWalletRelayVerifier: nativeRelayVerifierAddress,
    };
  }

  if (utilTokenFlag && networkName != 'mainnet') {
    const utilTokenAddress = await deployUtilToken(ethers);
    contractAddresses = {
      ...contractAddresses,
      UtilToken: utilTokenAddress,
    };
  }

  return contractAddresses as ContractAddresses;
};

const deployUtilToken = async (ethers: HardhatEthersHelpers) => {
  const utilTokenF = await ethers.getContractFactory('UtilToken');
  const { address } = await utilTokenF.deploy();

  return address;
};

const deployNativeHolderSmartWallet = async (ethers: HardhatEthersHelpers) => {
  const nativeHolderSmartWalletF = await ethers.getContractFactory(
    'NativeHolderSmartWallet'
  );
  const { address: nativeHolderSmartWalletAddress } =
    await nativeHolderSmartWalletF.deploy();
  const smartWalletFactoryF = await ethers.getContractFactory(
    'SmartWalletFactory'
  );
  const { address: nativeHolderSmartWalletFactoryAddress } =
    await smartWalletFactoryF.deploy(nativeHolderSmartWalletAddress);
  const deployVerifierF = await ethers.getContractFactory('DeployVerifier');
  const { address: nativeDeployVerifierAddress } = await deployVerifierF.deploy(
    nativeHolderSmartWalletFactoryAddress
  );
  const relayVerifierF = await ethers.getContractFactory('RelayVerifier');
  const { address: nativeRelayVerifierAddress } = await relayVerifierF.deploy(
    nativeHolderSmartWalletFactoryAddress
  );

  return {
    nativeHolderSmartWalletAddress,
    nativeHolderSmartWalletFactoryAddress,
    nativeDeployVerifierAddress,
    nativeRelayVerifierAddress,
  };
};

const deployCustomSmartWallet = async (ethers: HardhatEthersHelpers) => {
  const customSmartWalletF = await ethers.getContractFactory(
    'CustomSmartWallet'
  );
  const { address: customSmartWalletAddress } =
    await customSmartWalletF.deploy();
  const customSmartWalletFactoryF = await ethers.getContractFactory(
    'CustomSmartWalletFactory'
  );
  const { address: customSmartWalletFactoryAddress } =
    await customSmartWalletFactoryF.deploy(customSmartWalletAddress);
  const customSmartWalletDeployVerifierF = await ethers.getContractFactory(
    'CustomSmartWalletDeployVerifier'
  );
  const { address: customDeployVerifierAddress } =
    await customSmartWalletDeployVerifierF.deploy(
      customSmartWalletFactoryAddress
    );
  const relayVerifierF = await ethers.getContractFactory('RelayVerifier');
  const { address: customRelayVerifierAddress } = await relayVerifierF.deploy(
    customSmartWalletFactoryAddress
  );

  return {
    customSmartWalletFactoryAddress,
    customSmartWalletAddress,
    customDeployVerifierAddress,
    customRelayVerifierAddress,
  };
};

const deployDefaultSmartWallet = async (ethers: HardhatEthersHelpers) => {
  const smartWalletF = await ethers.getContractFactory('SmartWallet');
  const { address: smartWalletAddress } = await smartWalletF.deploy();

  const smartWalletFactoryF = await ethers.getContractFactory(
    'SmartWalletFactory'
  );
  const { address: smartWalletFactoryAddress } =
    await smartWalletFactoryF.deploy(smartWalletAddress);

  const deployVerifierF = await ethers.getContractFactory('DeployVerifier');
  const { address: deployVerifierAddress } = await deployVerifierF.deploy(
    smartWalletFactoryAddress
  );

  const relayVerifierF = await ethers.getContractFactory('RelayVerifier');
  const { address: relayVerifierAddress } = await relayVerifierF.deploy(
    smartWalletFactoryAddress
  );

  return {
    smartWalletAddress,
    smartWalletFactoryAddress,
    deployVerifierAddress,
    relayVerifierAddress,
  };
};

const deployRelayHub = async (ethers: HardhatEthersHelpers) => {
  const relayHubF = await ethers.getContractFactory('RelayHub');
  const penalizerF = await ethers.getContractFactory('Penalizer');
  const { address: penalizerAddress } = await penalizerF.deploy();
  const { address: relayHubAddress } = await relayHubF.deploy(
    penalizerAddress,
    1,
    1,
    1,
    1
  );

  return {
    relayHubAddress,
    penalizerAddress,
  };
};

export const deploy = async (
  deployArg: DeployArg,
  hre: HardhatRuntimeEnvironment
) => {
  const {
    ethers,
    hardhatArguments: { network },
  } = hre;
  const contractAddresses = await deployContracts(deployArg, ethers, network);
  console.table(contractAddresses);
  const newConfig = await updateConfig(contractAddresses, hre);
  writeConfigToDisk(newConfig);
};
