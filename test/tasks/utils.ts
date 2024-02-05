import fs from 'fs';
import sinon from 'sinon';

const defaultContractAddresses = {
  Penalizer: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  RelayHub: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  SmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  SmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  DeployVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  RelayVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  CustomSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  CustomSmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  CustomSmartWalletDeployVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  CustomSmartWalletRelayVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  NativeHolderSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  NativeHolderSmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  NativeHolderSmartWalletDeployVerifier:
    '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  NativeHolderSmartWalletRelayVerifier:
    '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  BoltzSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  BoltzSmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  BoltzDeployVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  BoltzRelayVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  VersionRegistry: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
  UtilToken: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
};

const defaultChainContractAddresses = {
  'hardhat.33': defaultContractAddresses,
};

export const stubReadFileSync = (
  chainContractAddresses = defaultChainContractAddresses
) => {
  sinon
    .stub(fs, 'readFileSync')
    .returns(JSON.stringify(chainContractAddresses));
};
