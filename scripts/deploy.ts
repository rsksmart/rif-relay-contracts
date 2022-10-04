import { config, ethers, hardhatArguments } from 'hardhat';
import fs from 'node:fs';
import { contracts } from '../typechain-types/factories';

const ADDRESS_FILE = process.env.ADDRESS_FILE || 'contract-addresses.json';

const factoryList = {
  ...contracts,
  ...contracts.factory,
  ...contracts.smartwallet,
  ...contracts.utils,
  ...contracts.verifier,
} as const;

export type FactoryName = Omit<
  Extract<keyof typeof factoryList, `${string}__factory`>,
  'Migrations__factory'
>;

export type ContractName = FactoryName extends `${infer Prefix}__factory`
  ? Prefix
  : never;

export type ContractAddresses = {
  [key in ContractName]: string | undefined;
};

export type NetworkAddresses = {
  [key: `${number}`]: ContractAddresses;
};

export const getExistingConfig = () => {
  try {
    if (fs.existsSync(ADDRESS_FILE)) {
      return JSON.parse(
        fs.readFileSync(ADDRESS_FILE, { encoding: 'utf-8' })
      ) as ContractAddresses;
    }
  } catch (e) {
    console.warn(e);
  }
};

export const writeConfiig = (config: NetworkAddresses) => {
  fs.writeFileSync(ADDRESS_FILE, JSON.stringify(config));
};

export const generateJsonConfig = (contractAddresses: ContractAddresses) => {
  console.log('Generating network config...');

  const { network } = hardhatArguments;
  if (!network) {
    throw new Error('Unknown Network');
  }
  const { chainId } = config.networks[network];

  if (!chainId) {
    throw new Error('Unknown Chain Id');
  }

  return {
    ...getExistingConfig(),
    contractAddresses,
  };
};

export const deployContracts = async (): Promise<ContractAddresses> => {
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

  const { address: versionRegistryAddress } =
    await versionRegistryFactory.deploy();

  let utilTokenAddress;
  if (hardhatArguments.network != 'mainnet') {
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
    UtilToken: utilTokenAddress,
    VersionRegistry: versionRegistryAddress,
  };
};

const main = async () => {
  const contractAddresses = await deployContracts();
  console.table(contractAddresses);
  const newConfig = generateJsonConfig(contractAddresses);
  writeConfiig(newConfig);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
