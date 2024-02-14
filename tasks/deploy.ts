import { HardhatEthersHelpers, HardhatRuntimeEnvironment } from 'hardhat/types';
import fs from 'node:fs';
import { ContractAddresses, NetworkConfig } from '../utils/scripts/types';
import { parseJsonFile } from './utils';
import {
  deployRelayHub,
  deployDefaultSmartWallet,
  deployCustomSmartWallet,
  deployNativeHolderSmartWallet,
  deployUtilToken,
} from './deployers';

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
  ethers: HardhatEthersHelpers
): Promise<Partial<ContractAddresses>> => {
  const deployers: Record<
    keyof DeployArg,
    (ethers: HardhatEthersHelpers) => Promise<Partial<ContractAddresses>>
  > = {
    relayHub: deployRelayHub,
    defaulSmartWallet: deployDefaultSmartWallet,
    customSmartWallet: deployCustomSmartWallet,
    nativeHolderSmartWallet: deployNativeHolderSmartWallet,
    utilToken: deployUtilToken,
  };

  /*
   * If no arguments are specified, we deploy everything
   * otherwise, we get the active deployers only
   */
  const activeDeployers = Object.values(deployArg).every((v) => v === false)
    ? Object.values(deployers)
    : Object.entries(deployArg)
        .filter(([_, deployFlag]) => deployFlag)
        .map(([flagKey, _]) => deployers[flagKey as keyof DeployArg]);

  let contractAddresses: Partial<ContractAddresses> = {};
  for (const deployer of activeDeployers) {
    const deployedContracts = await deployer(ethers);
    contractAddresses = {
      ...contractAddresses,
      ...deployedContracts,
    };
  }

  return contractAddresses as ContractAddresses;
};

export const deploy = async (
  deployArg: DeployArg,
  hre: HardhatRuntimeEnvironment
) => {
  const { ethers } = hre;
  const contractAddresses = await deployContracts(deployArg, ethers);
  console.table(contractAddresses);
  const newConfig = await updateConfig(contractAddresses, hre);
  writeConfigToDisk(newConfig);
};
