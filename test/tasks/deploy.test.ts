import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract, ContractFactory } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import { deployContracts, updateConfig } from '../../tasks/deploy';
import { ContractAddresses } from '../../utils/scripts/types';

use(chaiAsPromised);

describe('Deploy Script', function () {
  describe('deployContracts', function () {
    const testAddress = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7';
    beforeEach(function () {
      const contract = new Contract(testAddress, []);
      const contractFactoryStub = sinon.createStubInstance(ContractFactory);
      sinon.stub(ethers, 'getContractFactory').resolves(contractFactoryStub);
      contractFactoryStub.deploy.resolves(contract);
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should deploy all contracts', async function () {
      const result = await deployContracts(ethers, hre.network.name);
      expect(result).to.have.all.keys(
        'Penalizer',
        'RelayHub',
        'SmartWallet',
        'SmartWalletFactory',
        'DeployVerifier',
        'RelayVerifier',
        'CustomSmartWallet',
        'CustomSmartWalletFactory',
        'CustomSmartWalletDeployVerifier',
        'CustomSmartWalletRelayVerifier',
        'NativeHolderSmartWallet',
        'NativeHolderSmartWalletFactory',
        'NativeHolderSmartWalletDeployVerifier',
        'NativeHolderSmartWalletRelayVerifier',
        'BoltzSmartWallet',
        'BoltzSmartWalletFactory',
        'BoltzDeployVerifier',
        'BoltzRelayVerifier',
        'MinimalBoltzSmartWallet',
        'MinimalBoltzSmartWalletFactory',
        'VersionRegistry',
        'UtilToken'
      );
    });

    it('should deploy contracts with valid addresses', async function () {
      const result = await deployContracts(ethers, hre.network.name);
      Object.values(result).forEach((value) => {
        expect(value, value).to.eq(testAddress);
      });
    });

    it('should not deploy UtilToken in mainnet', async function () {
      hre.hardhatArguments.network = 'mainnet';
      const result = await deployContracts(
        ethers,
        hre.hardhatArguments.network
      );
      expect(result.UtilToken).to.be.undefined;
    });
  });

  describe('generateJsonConfig', function () {
    const contractAddresses: ContractAddresses = {
      Penalizer: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      RelayHub: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      SmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      SmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      DeployVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      RelayVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWalletDeployVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWalletRelayVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      VersionRegistry: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      UtilToken: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      NativeHolderSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      BoltzSmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      MinimalBoltzSmartWalletFactory:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      BoltzSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      MinimalBoltzSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      BoltzDeployVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      BoltzRelayVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      NativeHolderSmartWalletFactory:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      NativeHolderSmartWalletDeployVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      NativeHolderSmartWalletRelayVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };

    const chainContractAddresses = {
      '33': contractAddresses,
    };

    let spyWriteFileSync: sinon.SinonSpy;

    beforeEach(function () {
      spyWriteFileSync = sinon.spy(fs, 'writeFileSync');
      hre.hardhatArguments.network = 'regtest';
      if (hre.config.networks['regtest']) {
        hre.config.networks['regtest'].chainId = 33;
      }
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should generate a json config file with existing config file', async function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      await updateConfig(contractAddresses, hre);
      spyWriteFileSync.calledOnceWith(
        'contract-addresses.json',
        JSON.stringify(chainContractAddresses)
      );
    });

    it('should generate a json config file when config file is not present', async function () {
      sinon.stub(fs, 'existsSync').returns(false);
      await updateConfig(contractAddresses, hre);
      spyWriteFileSync.calledOnceWith(
        'contract-addresses.json',
        JSON.stringify(chainContractAddresses)
      );
    });

    it('should throw if network is undefined', async function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      hre.hardhatArguments.network = undefined;
      if (hre.config.networks['regtest']) {
        hre.config.networks['regtest'].chainId = 33;
      }
      await expect(updateConfig(contractAddresses, hre)).to.be.rejectedWith(
        'Unknown Network'
      );
    });

    it('should throw if chainId is undefined', async function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      hre.hardhatArguments.network = 'regtest';
      if (hre.config.networks['regtest']) {
        hre.config.networks['regtest'].chainId = undefined;
      }
      await expect(updateConfig(contractAddresses, hre)).to.to.be.rejectedWith(
        'Unknown Chain Id'
      );
    });
  });
});
