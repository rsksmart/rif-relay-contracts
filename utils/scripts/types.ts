import {contracts} from '../../typechain-types/factories';

const factoryList = {
    ...contracts,
    ...contracts.factory,
    ...contracts.smartwallet,
    ...contracts.utils,
    ...contracts.verifier,
  } as const;
  
  export type FactoryName = Exclude<Extract<keyof typeof factoryList, `${string}__factory`>,
    'Migrations__factory' | 'Collector__factory' | 'Ownable__factory' | 'TokenHandler__factory' >;
  
  export type ContractName = FactoryName extends `${infer Prefix}__factory`
    ? Prefix
    : never ;
  
  export type ContractAddresses = {
    [key in (ContractName | 'CustomSmartWalletRelayVerifier' | 'NativeHolderSmartWalletFactory' | 'NativeHolderSmartWalletDeployVerifier' | 'NativeHolderSmartWalletRelayVerifier')]: string | undefined;
  };
  
  export type NetworkConfig = {
    [key: `${number}`]: ContractAddresses;
  };