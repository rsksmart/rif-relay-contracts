import { HardhatEthersHelpers } from 'hardhat/types';
import { ContractAddresses } from '../utils/scripts/types';

export const deployVersionRegistry = async (
  ethers: HardhatEthersHelpers
): Promise<Pick<ContractAddresses, 'VersionRegistry'>> => {
  const versionRegistryFactory = await ethers.getContractFactory(
    'VersionRegistry'
  );
  const { address } = await versionRegistryFactory.deploy();

  return { VersionRegistry: address };
};

export const deployUtilToken = async (
  ethers: HardhatEthersHelpers
): Promise<Partial<Pick<ContractAddresses, 'UtilToken'>>> => {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 30) {
    const utilTokenF = await ethers.getContractFactory('UtilToken');
    const { address: utilTokenAddress } = await utilTokenF.deploy();

    return { UtilToken: utilTokenAddress };
  }

  return {};
};

export const deployNativeHolderSmartWallet = async (
  ethers: HardhatEthersHelpers
): Promise<
  Pick<
    ContractAddresses,
    | 'NativeHolderSmartWallet'
    | 'NativeHolderSmartWalletFactory'
    | 'NativeHolderSmartWalletDeployVerifier'
    | 'NativeHolderSmartWalletRelayVerifier'
  >
> => {
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
  const { address: nativeHolderSmartWalletDeployVerifierAddress } =
    await deployVerifierF.deploy(nativeHolderSmartWalletFactoryAddress);
  const relayVerifierF = await ethers.getContractFactory('RelayVerifier');
  const { address: nativeHolderSmartWalletRelayVerifierAddress } =
    await relayVerifierF.deploy(nativeHolderSmartWalletFactoryAddress);

  return {
    NativeHolderSmartWallet: nativeHolderSmartWalletAddress,
    NativeHolderSmartWalletFactory: nativeHolderSmartWalletFactoryAddress,
    NativeHolderSmartWalletDeployVerifier:
      nativeHolderSmartWalletDeployVerifierAddress,
    NativeHolderSmartWalletRelayVerifier:
      nativeHolderSmartWalletRelayVerifierAddress,
  };
};

export const deployCustomSmartWallet = async (
  ethers: HardhatEthersHelpers
): Promise<
  Pick<
    ContractAddresses,
    | 'CustomSmartWallet'
    | 'CustomSmartWalletFactory'
    | 'CustomSmartWalletDeployVerifier'
    | 'CustomSmartWalletRelayVerifier'
  >
> => {
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
  const { address: customSmartWalletDeployVerifierAddress } =
    await customSmartWalletDeployVerifierF.deploy(
      customSmartWalletFactoryAddress
    );
  const relayVerifierF = await ethers.getContractFactory('RelayVerifier');
  const { address: customSmartWalletRelayVerifierAddress } =
    await relayVerifierF.deploy(customSmartWalletFactoryAddress);

  return {
    CustomSmartWalletFactory: customSmartWalletFactoryAddress,
    CustomSmartWallet: customSmartWalletAddress,
    CustomSmartWalletDeployVerifier: customSmartWalletDeployVerifierAddress,
    CustomSmartWalletRelayVerifier: customSmartWalletRelayVerifierAddress,
  };
};

export const deployDefaultSmartWallet = async (
  ethers: HardhatEthersHelpers
): Promise<
  Pick<
    ContractAddresses,
    'SmartWallet' | 'SmartWalletFactory' | 'RelayVerifier' | 'DeployVerifier'
  >
> => {
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
    SmartWallet: smartWalletAddress,
    SmartWalletFactory: smartWalletFactoryAddress,
    DeployVerifier: deployVerifierAddress,
    RelayVerifier: relayVerifierAddress,
  };
};
export const deployRelayHub = async (
  ethers: HardhatEthersHelpers
): Promise<Pick<ContractAddresses, 'RelayHub' | 'Penalizer'>> => {
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
    RelayHub: relayHubAddress,
    Penalizer: penalizerAddress,
  };
};
