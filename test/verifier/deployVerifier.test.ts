import {
  FakeContract,
  MockContract,
  MockContractFactory,
  smock,
} from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat';
import {
  DeployVerifier,
  DeployVerifier__factory,
  ERC20,
  SmartWalletFactory,
  SmartWallet__factory,
} from 'typechain-types';
import { EnvelopingTypes, RelayHub } from 'typechain-types/contracts/RelayHub';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe('DeployVerifier Contract', function () {
  let fakeToken: FakeContract<ERC20>;
  let fakeWalletFactory: FakeContract<SmartWalletFactory>;
  let deployVerifierFactoryMock: MockContractFactory<DeployVerifier__factory>;
  let deployVerifierMock: MockContract<DeployVerifier>;

  beforeEach(async function () {
    fakeToken = await smock.fake<ERC20>('ERC20');
    fakeWalletFactory = await smock.fake<SmartWalletFactory>(
      'SmartWalletFactory'
    );
    deployVerifierFactoryMock = await smock.mock<DeployVerifier__factory>(
      'DeployVerifier'
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

  describe('acceptToken', function () {
    it('should set a token address in the acceptedTokens list', async function () {
      await deployVerifierMock.acceptToken(fakeToken.address);
      const acceptsToken = await deployVerifierMock.acceptsToken(
        fakeToken.address
      );
      expect(acceptsToken).to.be.true;
    });

    it('should revert if address is not a contract', async function () {
      const eoa = ethers.Wallet.createRandom().address;
      const result = deployVerifierMock.acceptToken(eoa);
      await expect(result).to.be.revertedWith('Address is not a contract');
    });

    it('should revert if token is already in the acceptedTokens list', async function () {
      await deployVerifierMock.setVariable('tokens', {
        [fakeToken.address]: true,
      });
      const result = deployVerifierMock.acceptToken(fakeToken.address);
      await expect(result).to.be.revertedWith('Token is already accepted');
    });

    it('should revert if accepting a token with ZERO ADDRESS', async function () {
      const result = deployVerifierMock.acceptToken(constants.AddressZero);

      await expect(result).to.be.revertedWith('Token cannot be zero address');
    });

    it('should revert if caller is not the owner', async function () {
      const [other] = (await ethers.getSigners()).slice(1) as [
        SignerWithAddress
      ];

      await expect(
        deployVerifierMock.connect(other).acceptToken(fakeToken.address)
      ).to.be.revertedWith('Caller is not the owner');
    });
  });

  describe('removeToken', function () {
    it('should remove a token from tokens map', async function () {
      await deployVerifierMock.setVariables({
        tokens: {
          [fakeToken.address]: true,
        },
        acceptedTokens: [ethers.utils.getAddress(fakeToken.address)],
      });

      await deployVerifierMock.removeToken(fakeToken.address, 0);

      const tokenMapValue = (await deployVerifierMock.getVariable('tokens', [
        fakeToken.address,
      ])) as boolean;

      expect(tokenMapValue).to.be.false;
    });

    it('should remove a token from acceptedTokens array', async function () {
      await deployVerifierMock.setVariables({
        tokens: {
          [fakeToken.address]: true,
        },
        acceptedTokens: [fakeToken.address],
      });

      await deployVerifierMock.removeToken(fakeToken.address, 0);

      const acceptedTokens = await deployVerifierMock.getAcceptedTokens();

      expect(acceptedTokens).to.not.contain(fakeToken.address);
    });

    it('should revert if token is not currently previously accepted', async function () {
      const result = deployVerifierMock.removeToken(fakeToken.address, 0);

      await expect(result).to.be.revertedWith('Token is not accepted');
    });

    it('should revert if token removed is ZERO ADDRESS', async function () {
      const result = deployVerifierMock.removeToken(constants.AddressZero, 0);

      await expect(result).to.be.revertedWith('Token cannot be zero address');
    });

    it('should revert if token index does not correspond to token address to be removed', async function () {
      const fakeToken1 = await smock.fake<ERC20>('ERC20');

      await deployVerifierMock.setVariables({
        tokens: {
          [fakeToken.address]: true,
          [fakeToken1.address]: true,
        },
        acceptedTokens: [fakeToken.address, fakeToken1.address],
      });

      const result = deployVerifierMock.removeToken(fakeToken.address, 1);
      await expect(result).to.be.revertedWith('Wrong token index');
    });

    it('should revert if caller is not the owner', async function () {
      const [other] = (await ethers.getSigners()).slice(1) as [
        SignerWithAddress
      ];

      await expect(
        deployVerifierMock.connect(other).acceptToken(fakeToken.address)
      ).to.be.revertedWith('Caller is not the owner');
    });
  });

  describe('getAcceptedTokens()', function () {
    it('should get all the accepted tokens', async function () {
      const fakeTokenList = [fakeToken.address];
      await deployVerifierMock.setVariable('acceptedTokens', fakeTokenList);

      const acceptedTokens = await deployVerifierMock.getAcceptedTokens();
      expect(acceptedTokens).to.deep.equal(fakeTokenList);
    });
  });

  describe('acceptsToken()', function () {
    beforeEach(async function () {
      const { address } = fakeToken;
      await deployVerifierMock.setVariable('tokens', {
        [address]: true,
      });
    });

    it('should return true if token is accepted', async function () {
      const acceptsToken = await deployVerifierMock.acceptsToken(
        fakeToken.address
      );
      expect(acceptsToken).to.be.true;
    });

    it('should return false if token is not accepted', async function () {
      const fakeTokenUnaccepted = await smock.fake<ERC20>('ERC20');
      const acceptsToken = await deployVerifierMock.acceptsToken(
        fakeTokenUnaccepted.address
      );
      expect(acceptsToken).to.be.false;
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

    it('should not revert', async function () {
      await deployVerifierMock.setVariables({
        acceptedTokens: [fakeToken.address],
        tokens: {
          [fakeToken.address]: true,
        },
      });
      fakeToken.balanceOf.returns(BigNumber.from('200000000000'));

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
      await expect(result).to.not.be.reverted;
    });

    it('should revert if token contract is not allowed', async function () {
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
      await expect(result).to.be.revertedWith('Token contract not allowed');
    });

    it('should revert if factory address in request is different than factory address in contract', async function () {
      fakeToken.balanceOf.returns(BigNumber.from('200000000000'));

      await deployVerifierMock.setVariables({
        acceptedTokens: [fakeToken.address],
        tokens: {
          [fakeToken.address]: true,
        },
      });
      const differentFactoryFake = await smock.fake('SmartWalletFactory');

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
      fakeToken.balanceOf.returns(BigNumber.from('200000000000'));
      await deployVerifierMock.setVariables({
        acceptedTokens: [fakeToken.address],
        tokens: {
          [fakeToken.address]: true,
        },
      });

      const fakeSmartWalletFactory = await smock.mock<SmartWallet__factory>(
        'SmartWallet'
      );
      const mockSmartWallet = await fakeSmartWalletFactory.deploy();
      await mockSmartWallet.setVariables({
        nonce: 1,
        domainSeparator:
          '0x6c00000000000000000000000000000000000000000000000000000000000000',
      });

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
      await expect(result).to.be.revertedWith('Address already created');
    });

    it('should revert if token balance is too low', async function () {
      fakeToken.balanceOf.returns(BigNumber.from('10'));

      await deployVerifierMock.setVariables({
        acceptedTokens: [fakeToken.address],
        tokens: {
          [fakeToken.address]: true,
        },
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
      await expect(result).to.be.revertedWith('balance too low');
    });
  });
});
