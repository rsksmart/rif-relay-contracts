import {
  FakeContract,
  MockContract,
  MockContractFactory,
  smock,
} from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import {
  MinimalBoltzDeployVerifier,
  MinimalBoltzDeployVerifier__factory,
  ERC20,
  MinimalBoltzSmartWalletFactory,
  MinimalBoltzSmartWallet__factory,
} from 'typechain-types';
import { EnvelopingTypes, RelayHub } from 'typechain-types/contracts/RelayHub';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe('MinimalBoltzDeployVerifier Contract', function () {
  let fakeToken: FakeContract<ERC20>;
  let fakeWalletFactory: FakeContract<MinimalBoltzSmartWalletFactory>;
  let deployVerifierFactoryMock: MockContractFactory<MinimalBoltzDeployVerifier__factory>;
  let deployVerifierMock: MockContract<MinimalBoltzDeployVerifier>;

  beforeEach(async function () {
    fakeToken = await smock.fake<ERC20>('ERC20');
    fakeWalletFactory = await smock.fake<MinimalBoltzSmartWalletFactory>(
      'MinimalBoltzSmartWalletFactory'
    );
    deployVerifierFactoryMock =
      await smock.mock<MinimalBoltzDeployVerifier__factory>(
        'MinimalBoltzDeployVerifier'
      );
    deployVerifierMock = await deployVerifierFactoryMock.deploy(
      fakeWalletFactory.address
    );
  });

  describe('constructor', function () {
    it('Should deploy', async function () {
      const deployVerifier = deployVerifierFactoryMock.deploy(
        fakeWalletFactory.address
      );

      await expect(deployVerifier).to.not.be.reverted;
    });
  });

  describe('versionVerifier()', function () {
    it('should get the current version', async function () {
      const version = await deployVerifierMock.versionVerifier();
      expect(version).to.eq('rif.enveloping.token.iverifier@2.0.1');
    });
  });

  describe('verifyRelayedCall()', function () {
    let owner: SignerWithAddress;
    let recipient: SignerWithAddress;
    let relayWorker: SignerWithAddress;
    let fakeRelayHub: FakeContract<RelayHub>;

    beforeEach(async function () {
      [owner, recipient, relayWorker] = (await ethers.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress,
        SignerWithAddress
      ];
      fakeRelayHub = await smock.fake<RelayHub>('RelayHub');
    });

    it('should not revert if destination contract provide enough balance', async function () {
      await deployVerifierMock.setVariables({
        _factory: fakeWalletFactory.address,
      });

      const ABI = [
        'function claim(bytes32 preimage, uint amount,address refundAddress, uint timelock)',
      ];
      const abiInterface = new ethers.utils.Interface(ABI);
      const data = abiInterface.encodeFunctionData('claim', [
        constants.HashZero,
        ethers.utils.parseEther('1'),
        constants.AddressZero,
        500,
      ]);

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: fakeWalletFactory.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data: data,
          from: owner.address,
          to: recipient.address,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: constants.AddressZero,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );

      await expect(result).to.not.be.reverted;
    });

    it('should not revert if not paying', async function () {
      await deployVerifierMock.setVariables({
        _factory: fakeWalletFactory.address,
      });

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: fakeWalletFactory.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data: '0x00',
          from: owner.address,
          to: recipient.address,
          nonce: '0',
          tokenGas: '0',
          relayHub: fakeRelayHub.address,
          tokenAmount: '0',
          tokenContract: constants.AddressZero,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );

      await expect(result).to.not.be.reverted;
    });

    it('should revert if paying with ERC20 token', async function () {
      await deployVerifierMock.setVariables({
        _factory: fakeWalletFactory.address,
      });

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: fakeWalletFactory.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data: '0x00',
          from: owner.address,
          to: recipient.address,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.rejectedWith('RBTC necessary for payment');
    });

    it('should revert if factory address in request is different than factory address in contract', async function () {
      await deployVerifierMock.setVariables({
        _factory: fakeWalletFactory.address,
      });
      const differentFactoryFake = await smock.fake(
        'MinimalBoltzSmartWalletFactory'
      );

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: differentFactoryFake.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data: '0x00',
          from: owner.address,
          to: recipient.address,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Invalid factory');
    });

    it('should revert if Smart Wallet is already created', async function () {
      await deployVerifierMock.setVariables({
        _factory: fakeWalletFactory.address,
      });

      const fakeSmartWalletFactory =
        await smock.mock<MinimalBoltzSmartWallet__factory>(
          'MinimalBoltzSmartWallet'
        );
      const mockSmartWallet = await fakeSmartWalletFactory.deploy();

      fakeWalletFactory.getSmartWalletAddress.returns(mockSmartWallet.address);

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: fakeWalletFactory.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data: '0x00',
          from: owner.address,
          to: recipient.address,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Address already created!');
    });

    it('should revert if native token balance is too low', async function () {
      await deployVerifierMock.setVariables({
        _factory: fakeWalletFactory.address,
      });

      const ABI = [
        'function claim(bytes32 preimage, uint amount,address refundAddress, uint timelock)',
      ];
      const abiInterface = new ethers.utils.Interface(ABI);
      const data = abiInterface.encodeFunctionData('claim', [
        constants.HashZero,
        ethers.utils.parseEther('0.5'),
        constants.AddressZero,
        500,
      ]);

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: fakeWalletFactory.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data,
          from: owner.address,
          to: recipient.address,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: ethers.utils.parseEther('1'),
          tokenContract: constants.AddressZero,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Native balance too low');
    });
  });
});
