export interface IContractAddresses {
  Penalizer: string;
  RelayHub: string;
  SmartWallet: string;
  SmartWalletFactory: string;
  SmartWalletDeployVerifier: string;
  SmartWalletRelayVerifier: string;
  CustomSmartWallet: string;
  CustomSmartWalletFactory: string;
  CustomSmartWalletDeployVerifier: string;
  CustomSmartWalletRelayVerifier: string;
  UtilToken: string;
}
export interface IChainContractAddresses {
  [key: string]: IContractAddresses
}
