import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract, ContractFactory } from 'ethers';
import fs from 'fs';
import * as hardhat from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import {
  ContractAddresses,
  deployContracts,
  generateJsonConfig,
} from '../../scripts/deploy';

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
      const result = await deployContracts();
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
        'VersionRegistry',
        'UtilToken'
      );
    });

    it('should deploy contracts with valid addresses', async function () {
      const result = await deployContracts();
      Object.values(result).forEach((value) => {
        expect(value, value).to.eq(testAddress);
      });
    });

    it('should not deploy UtilToken if not in mainnet', async function () {
      hardhat.hardhatArguments.network = 'mainnet';
      const result = await deployContracts();
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
      VersionRegistry: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      UtilToken: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };

    const chainContractAddresses = {
      '33': contractAddresses,
    };

    let spyWriteFileSync: sinon.SinonSpy;

    beforeEach(function () {
      spyWriteFileSync = sinon.spy(fs, 'writeFileSync');
      hardhat.hardhatArguments.network = 'regtest';
      hardhat.config.networks.regtest.chainId = 33;
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should generate a json config file with existing config file', function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      generateJsonConfig(contractAddresses);
      spyWriteFileSync.calledOnceWith(
        'contract-addresses.json',
        JSON.stringify(chainContractAddresses)
      );
    });

    it('should generate a json config file when config file is not present', function () {
      sinon.stub(fs, 'existsSync').returns(false);
      generateJsonConfig(contractAddresses);
      spyWriteFileSync.calledOnceWith(
        'contract-addresses.json',
        JSON.stringify(chainContractAddresses)
      );
    });

    it('should throw if network is undefined', function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      hardhat.hardhatArguments.network = undefined;
      hardhat.config.networks.regtest.chainId = 33;
      expect(() => generateJsonConfig(contractAddresses)).to.throw(
        'Unknown Network'
      );
    });

    it('should throw if chainId is undefined', function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      hardhat.hardhatArguments.network = 'regtest';
      hardhat.config.networks.regtest.chainId = undefined;
      expect(() => generateJsonConfig(contractAddresses)).to.throw(
        'Unknown Chain Id'
      );
    });
  });
});
