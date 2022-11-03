import { HardhatEthersHelpers, HardhatRuntimeEnvironment } from 'hardhat/types';
import fs from 'node:fs';
import { ContractAddresses, NetworkConfig } from '../utils/scripts/types';

const ADDRESS_FILE = process.env['ADDRESS_FILE'] || 'contract-addresses.json';

export const getExistingConfig = () => {
  try {
    if (fs.existsSync(ADDRESS_FILE)) {
      return JSON.parse(
        fs.readFileSync(ADDRESS_FILE, { encoding: 'utf-8' })
      ) as { [key: string]: ContractAddresses };
    }
  } catch (e) {
    console.warn(e);
  }
  throw new Error(`File ${ADDRESS_FILE} not found`);
};

export const writeConfigToDisk = (config: NetworkConfig) => {
  fs.writeFileSync(ADDRESS_FILE, JSON.stringify(config));
  console.log(`address file available at: ${ADDRESS_FILE}`);
};

export const updateConfig = (
  contractAddresses: ContractAddresses,
  { hardhatArguments, config: { networks } }: HardhatRuntimeEnvironment
): NetworkConfig => {
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

  return {
    ...getExistingConfig(),
    [`${network}.${chainId}`]: contractAddresses,
  };
};

export const deployContracts = async (
  ethers: HardhatEthersHelpers,
  networkName?: string
): Promise<ContractAddresses> => {
  const relayHubF = await ethers.getContractFactory('RelayHub');
  const penalizerF = await ethers.getContractFactory('Penalizer');
  const smartWalletF = await ethers.getContractFactory('SmartWallet');
  const smartWalletFactoryF = await ethers.getContractFactory(
    'SmartWalletFactory'
  );
  const deployVerifierF = await ethers.getContractFactory('DeployVerifier');
  const relayVerifierF = await ethers.getContractFactory('RelayVerifier');
  const utilTokenF = await ethers.getContractFactory('UtilToken');

  const customSmartWalletF = await ethers.getContractFactory(
    'CustomSmartWallet'
  );
  const customSmartWalletFactoryF = await ethers.getContractFactory(
    'CustomSmartWalletFactory'
  );
  const customSmartWalletDeployVerifierF = await ethers.getContractFactory(
    'CustomSmartWalletDeployVerifier'
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
    smartWalletFactoryAddress
  );

  const { address: versionRegistryAddress } =
    await versionRegistryFactory.deploy();

  let utilTokenAddress;
  if (networkName != 'mainnet') {
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
    UtilToken: utilTokenAddress,
    VersionRegistry: versionRegistryAddress,
  };
};

export const deploy = async (hre: HardhatRuntimeEnvironment) => {
  const {
    ethers,
    hardhatArguments: { network },
  } = hre;
  const contractAddresses = await deployContracts(ethers, network);
  console.table(contractAddresses);
  const newConfig = updateConfig(contractAddresses, hre);
  writeConfigToDisk(newConfig);
};
