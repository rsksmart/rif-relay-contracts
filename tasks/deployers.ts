import { utils } from 'ethers';
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

export const deployBoltzSmartWallet = async (
  ethers: HardhatEthersHelpers
): Promise<
  Pick<
    ContractAddresses,
    | 'BoltzSmartWallet'
    | 'BoltzSmartWalletFactory'
    | 'BoltzRelayVerifier'
    | 'BoltzDeployVerifier'
  >
> => {
  const boltzSmartWalletF = await ethers.getContractFactory('SwapSmartWallet');
  const { address: boltzSmartWalletAddress } = await boltzSmartWalletF.deploy();

  const boltzSmartWalletFactoryF = await ethers.getContractFactory(
    'SwapSmartWalletFactory'
  );
  const { address: boltzSmartWalletFactoryAddress } =
    await boltzSmartWalletFactoryF.deploy(boltzSmartWalletAddress);

  const boltzDeployVerifierF = await ethers.getContractFactory(
    'BoltzDeployVerifier'
  );
  const { address: boltzDeployVerifierAddress } =
    await boltzDeployVerifierF.deploy(boltzSmartWalletFactoryAddress);

  const boltzRelayVerifierF = await ethers.getContractFactory(
    'BoltzRelayVerifier'
  );
  const { address: boltzRelayVerifierAddress } =
    await boltzRelayVerifierF.deploy(boltzSmartWalletFactoryAddress);

  return {
    BoltzSmartWallet: boltzSmartWalletAddress,
    BoltzSmartWalletFactory: boltzSmartWalletFactoryAddress,
    BoltzDeployVerifier: boltzDeployVerifierAddress,
    BoltzRelayVerifier: boltzRelayVerifierAddress,
  };
};

// Boltz EtherSwap claim methods a minimal wallet can execute
export const BOLTZ_CLAIM_METHODS = [
  'claim(bytes32,uint256,address,uint256)',
  'claim(bytes32,uint256,address,address,uint256)',
].map((signature) => utils.id(signature).slice(0, 10));

export const deployMinimalBoltzSmartWallet = async (
  ethers: HardhatEthersHelpers
): Promise<
  Pick<
    ContractAddresses,
    | 'MinimalBoltzSmartWallet'
    | 'MinimalBoltzSmartWalletFactory'
    | 'MinimalBoltzRelayVerifier'
    | 'MinimalBoltzDeployVerifier'
  >
> => {
  const boltzSmartWalletF = await ethers.getContractFactory(
    'MinimalSwapSmartWallet'
  );
  const { address: boltzSmartWalletAddress } = await boltzSmartWalletF.deploy(
    BOLTZ_CLAIM_METHODS
  );

  const boltzSmartWalletFactoryF = await ethers.getContractFactory(
    'MinimalSwapSmartWalletFactory'
  );
  const { address: boltzSmartWalletFactoryAddress } =
    await boltzSmartWalletFactoryF.deploy(boltzSmartWalletAddress);

  const boltzDeployVerifierF = await ethers.getContractFactory(
    'MinimalBoltzDeployVerifier'
  );
  const { address: boltzDeployVerifierAddress } =
    await boltzDeployVerifierF.deploy(boltzSmartWalletFactoryAddress);

  const boltzRelayVerifierF = await ethers.getContractFactory(
    'MinimalSwapRelayVerifier'
  );
  const { address: boltzRelayVerifierAddress } =
    await boltzRelayVerifierF.deploy(boltzSmartWalletFactoryAddress);

  return {
    MinimalBoltzSmartWallet: boltzSmartWalletAddress,
    MinimalBoltzSmartWalletFactory: boltzSmartWalletFactoryAddress,
    MinimalBoltzDeployVerifier: boltzDeployVerifierAddress,
    MinimalBoltzRelayVerifier: boltzRelayVerifierAddress,
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

export const deployLendaswapSmartWallet = async (
  ethers: HardhatEthersHelpers
): Promise<
  Pick<
    ContractAddresses,
    | 'LendaswapSmartWallet'
    | 'LendaswapSmartWalletFactory'
    | 'LendaswapRelayVerifier'
    | 'LendaswapDeployVerifier'
  >
> => {
  const lendaswapSmartWalletF = await ethers.getContractFactory(
    'SwapSmartWallet'
  );
  const { address: lendaswapSmartWalletAddress } =
    await lendaswapSmartWalletF.deploy();

  const lendaswapSmartWalletFactoryF = await ethers.getContractFactory(
    'SwapSmartWalletFactory'
  );
  const { address: lendaswapSmartWalletFactoryAddress } =
    await lendaswapSmartWalletFactoryF.deploy(lendaswapSmartWalletAddress);

  const lendaswapDeployVerifierF = await ethers.getContractFactory(
    'LendaswapDeployVerifier'
  );
  const { address: lendaswapDeployVerifierAddress } =
    await lendaswapDeployVerifierF.deploy(lendaswapSmartWalletFactoryAddress);

  const lendaswapRelayVerifierF = await ethers.getContractFactory(
    'LendaswapRelayVerifier'
  );
  const { address: lendaswapRelayVerifierAddress } =
    await lendaswapRelayVerifierF.deploy(lendaswapSmartWalletFactoryAddress);

  return {
    LendaswapSmartWallet: lendaswapSmartWalletAddress,
    LendaswapSmartWalletFactory: lendaswapSmartWalletFactoryAddress,
    LendaswapDeployVerifier: lendaswapDeployVerifierAddress,
    LendaswapRelayVerifier: lendaswapRelayVerifierAddress,
  };
};

// Lendaswap HTLCNative methods a minimal wallet can execute
export const LENDASWAP_REDEEM_METHODS = [
  'redeem(bytes32,uint256,address,uint256)',
  'redeemBySig(bytes32,uint256,address,uint256,address,address,uint256,bytes32,uint8,bytes32,bytes32)',
].map((signature) => utils.id(signature).slice(0, 10));

export const deployMinimalLendaswapSmartWallet = async (
  ethers: HardhatEthersHelpers
): Promise<
  Pick<
    ContractAddresses,
    | 'MinimalLendaswapSmartWallet'
    | 'MinimalLendaswapSmartWalletFactory'
    | 'MinimalLendaswapRelayVerifier'
    | 'MinimalLendaswapDeployVerifier'
  >
> => {
  const lendaswapSmartWalletF = await ethers.getContractFactory(
    'MinimalSwapSmartWallet'
  );
  const { address: lendaswapSmartWalletAddress } =
    await lendaswapSmartWalletF.deploy(LENDASWAP_REDEEM_METHODS);

  const lendaswapSmartWalletFactoryF = await ethers.getContractFactory(
    'MinimalSwapSmartWalletFactory'
  );
  const { address: lendaswapSmartWalletFactoryAddress } =
    await lendaswapSmartWalletFactoryF.deploy(lendaswapSmartWalletAddress);

  const lendaswapDeployVerifierF = await ethers.getContractFactory(
    'MinimalLendaswapDeployVerifier'
  );
  const { address: lendaswapDeployVerifierAddress } =
    await lendaswapDeployVerifierF.deploy(lendaswapSmartWalletFactoryAddress);

  const lendaswapRelayVerifierF = await ethers.getContractFactory(
    'MinimalSwapRelayVerifier'
  );
  const { address: lendaswapRelayVerifierAddress } =
    await lendaswapRelayVerifierF.deploy(lendaswapSmartWalletFactoryAddress);

  return {
    MinimalLendaswapSmartWallet: lendaswapSmartWalletAddress,
    MinimalLendaswapSmartWalletFactory: lendaswapSmartWalletFactoryAddress,
    MinimalLendaswapDeployVerifier: lendaswapDeployVerifierAddress,
    MinimalLendaswapRelayVerifier: lendaswapRelayVerifierAddress,
  };
};
