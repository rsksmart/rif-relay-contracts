import { ethers } from 'hardhat';
import {
  FakeContract,
  MockContract,
  MockContractFactory,
  smock,
} from '@defi-wonderland/smock';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, constants } from 'ethers';
import {
  ERC20,
  RelayVerifier,
  RelayVerifier__factory,
  SmartWallet,
  SmartWalletFactory,
} from 'typechain-types';
import { EnvelopingTypes, RelayHub } from 'typechain-types/contracts/RelayHub';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe('RelayVerifier Contract', function () {
  let fakeToken: FakeContract<ERC20>;
  let fakeWalletFactory: FakeContract<SmartWalletFactory>;
  let relayVerifierFactoryMock: MockContractFactory<RelayVerifier__factory>;
  let relayVerifierMock: MockContract<RelayVerifier>;

  beforeEach(async function () {
    fakeToken = await smock.fake<ERC20>('ERC20');
    fakeWalletFactory = await smock.fake<SmartWalletFactory>(
      'SmartWalletFactory'
    );
    relayVerifierFactoryMock = await smock.mock<RelayVerifier__factory>(
      'RelayVerifier'
    );
    relayVerifierMock = await relayVerifierFactoryMock.deploy(
      fakeWalletFactory.address
    );
  });

  describe('constructor', function () {
    it('Should deploy', async function () {
      const relayVerifier = relayVerifierFactoryMock.deploy(
        fakeWalletFactory.address
      );

      await expect(relayVerifier).to.not.be.reverted;
    });
  });

  describe('acceptToken', function () {
    it('should map a token address into the tokens mapping', async function () {
      await relayVerifierMock.acceptToken(fakeToken.address);
      const tokenMapValue = (await relayVerifierMock.getVariable('tokens', [
        fakeToken.address,
      ])) as boolean;

      expect(tokenMapValue).to.be.true;
    });

    it('should push a token into the acceptedTokens array', async function () {
      await relayVerifierMock.acceptToken(fakeToken.address);
      const acceptedTokens = await relayVerifierMock.getAcceptedTokens();

      expect(acceptedTokens).to.include(fakeToken.address);
    });

    it('should revert if token is already accepted', async function () {
      await relayVerifierMock.setVariables({
        tokens: {
          [fakeToken.address]: true,
        },
        acceptedTokens: [ethers.utils.getAddress(fakeToken.address)],
      });
      const result = relayVerifierMock.acceptToken(fakeToken.address);

      await expect(result).to.be.revertedWith('Token is already accepted');
    });

    it('should revert if token is ZERO ADDRESS', async function () {
      const result = relayVerifierMock.acceptToken(constants.AddressZero);

      await expect(result).to.be.revertedWith('Token cannot be zero address');
    });

    it('should revert if caller is not the owner', async function () {
      const [, other] = await ethers.getSigners();

      await expect(
        relayVerifierMock.connect(other).acceptToken(fakeToken.address)
      ).to.be.revertedWith('Caller is not the owner');
    });
  });

  describe('removeToken', function () {
    it('should remove a token from tokens map', async function () {
      await relayVerifierMock.setVariables({
        tokens: {
          [fakeToken.address]: true,
        },
        acceptedTokens: [ethers.utils.getAddress(fakeToken.address)],
      });

      await relayVerifierMock.removeToken(fakeToken.address, 0);

      const tokenMapValue = (await relayVerifierMock.getVariable('tokens', [
        fakeToken.address,
      ])) as boolean;

      expect(tokenMapValue).to.be.false;
    });

    it('should remove a token from acceptedTokens array', async function () {
      await relayVerifierMock.setVariables({
        tokens: {
          [fakeToken.address]: true,
        },
        acceptedTokens: [fakeToken.address],
      });

      await relayVerifierMock.removeToken(fakeToken.address, 0);

      const acceptedTokens = await relayVerifierMock.getAcceptedTokens();

      expect(acceptedTokens).to.not.contain(fakeToken.address);
    });

    it('should revert if token is not currently previously accepted', async function () {
      const result = relayVerifierMock.removeToken(fakeToken.address, 0);

      await expect(result).to.be.revertedWith('Token is not accepted');
    });

    it('should revert if token removed is ZERO ADDRESS', async function () {
      const result = relayVerifierMock.removeToken(constants.AddressZero, 0);

      await expect(result).to.be.revertedWith('Token cannot be zero address');
    });

    it('should revert if token index does not correspond to token address to be removed', async function () {
      const fakeToken1 = await smock.fake<ERC20>('ERC20');

      await relayVerifierMock.setVariables({
        tokens: {
          [fakeToken.address]: true,
          [fakeToken1.address]: true,
        },
        acceptedTokens: [fakeToken.address, fakeToken1.address],
      });

      const result = relayVerifierMock.removeToken(fakeToken.address, 1);
      await expect(result).to.be.revertedWith('Wrong token index');
    });

    it('should revert if caller is not the owner', async function () {
      const [, other] = await ethers.getSigners();

      await expect(
        relayVerifierMock.connect(other).acceptToken(fakeToken.address)
      ).to.be.revertedWith('Caller is not the owner');
    });
  });

  describe('getAcceptedTokens()', function () {
    it('should get all the accepted tokens', async function () {
      const fakeTokenList = [fakeToken.address];

      await relayVerifierMock.setVariable('acceptedTokens', fakeTokenList);

      const acceptedTokens = await relayVerifierMock.getAcceptedTokens();
      expect(acceptedTokens).to.deep.equal(fakeTokenList);
    });
  });

  describe('acceptsToken()', function () {
    beforeEach(async function () {
      const { address } = fakeToken;
      await relayVerifierMock.setVariable('tokens', {
        [address]: true,
      });
    });

    it('should return true if token is accepted', async function () {
      const acceptsToken = await relayVerifierMock.acceptsToken(
        fakeToken.address
      );
      expect(acceptsToken).to.be.true;
    });

    it('should return false if token is not accepted', async function () {
      const fakeTokenUnaccepted = await smock.fake<ERC20>('ERC20');

      const acceptsToken = await relayVerifierMock.acceptsToken(
        fakeTokenUnaccepted.address
      );
      expect(acceptsToken).to.be.false;
    });
  });

  describe('versionVerifier()', function () {
    it('should get the current version', async function () {
      const version = await relayVerifierMock.versionVerifier();
      expect(version).to.eq('rif.enveloping.token.iverifier@2.0.1');
    });
  });

  describe('verifyRelayedCall()', function () {
    let owner: SignerWithAddress;
    let recipient: SignerWithAddress;
    let relayWorker: SignerWithAddress;
    let fakeSmartWallet: FakeContract<SmartWallet>;
    let fakeRelayHub: FakeContract<RelayHub>;

    beforeEach(async function () {
      [owner, recipient, relayWorker] = await ethers.getSigners();
      fakeSmartWallet = await smock.fake<SmartWallet>('SmartWallet');
      fakeRelayHub = await smock.fake<RelayHub>('RelayHub');
    });

    it('should not revert', async function () {
      fakeWalletFactory.runtimeCodeHash.returns(
        '0xbc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a'
      );
      fakeToken.balanceOf.returns(BigNumber.from('200000000000'));

      await relayVerifierMock.acceptToken(fakeToken.address);

      const relayRequest: EnvelopingTypes.RelayRequestStruct = {
        relayData: {
          callForwarder: fakeSmartWallet.address,
          callVerifier: relayVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          data: '0x00',
          from: owner.address,
          to: recipient.address,
          gas: '1000000',
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.not.be.reverted;
    });

    it('should revert if token contract is not allowed', async function () {
      const relayRequest: EnvelopingTypes.RelayRequestStruct = {
        relayData: {
          callForwarder: fakeSmartWallet.address,
          callVerifier: relayVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          data: '0x00',
          from: owner.address,
          to: recipient.address,
          gas: '1000000',
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.be.revertedWith('Token contract not allowed');
    });

    it('should revert if token balance is too low', async function () {
      fakeToken.balanceOf.returns(BigNumber.from('10'));

      await relayVerifierMock.acceptToken(fakeToken.address);

      const relayRequest: EnvelopingTypes.RelayRequestStruct = {
        relayData: {
          callForwarder: fakeSmartWallet.address,
          callVerifier: relayVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          data: '0x00',
          from: owner.address,
          to: recipient.address,
          gas: '1000000',
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.be.revertedWith('balance too low');
    });

    it('should revert if smart wallet template is different than smart wallet factory', async function () {
      fakeToken.balanceOf.returns(BigNumber.from('200000000000'));

      await relayVerifierMock.acceptToken(fakeToken.address);

      const relayRequest: EnvelopingTypes.RelayRequestStruct = {
        relayData: {
          callForwarder: fakeSmartWallet.address,
          callVerifier: relayVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          data: '0x00',
          from: owner.address,
          to: recipient.address,
          gas: '1000000',
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.be.revertedWith('SW different to template');
    });
  });
});
