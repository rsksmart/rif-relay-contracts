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
  MinimalBoltzRelayVerifier,
  MinimalBoltzRelayVerifier__factory,
  MinimalBoltzSmartWallet,
  MinimalBoltzSmartWalletFactory,
} from 'typechain-types';
import { EnvelopingTypes, RelayHub } from 'typechain-types/contracts/RelayHub';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe('MinimalBoltzRelayVerifier Contract', function () {
  let fakeWalletFactory: FakeContract<MinimalBoltzSmartWalletFactory>;
  let relayVerifierFactoryMock: MockContractFactory<MinimalBoltzRelayVerifier__factory>;
  let relayVerifierMock: MockContract<MinimalBoltzRelayVerifier>;

  beforeEach(async function () {
    fakeWalletFactory = await smock.fake<MinimalBoltzSmartWalletFactory>(
      'MinimalBoltzSmartWalletFactory'
    );
    relayVerifierFactoryMock =
      await smock.mock<MinimalBoltzRelayVerifier__factory>(
        'MinimalBoltzRelayVerifier'
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
    let fakeRelayHub: FakeContract<RelayHub>;
    let fakeSmartWallet: FakeContract<MinimalBoltzSmartWallet>;

    beforeEach(async function () {
      [owner, recipient, relayWorker] = (await ethers.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress,
        SignerWithAddress
      ];
      fakeRelayHub = await smock.fake<RelayHub>('RelayHub');
      fakeSmartWallet = await smock.fake<MinimalBoltzSmartWallet>(
        'MinimalBoltzSmartWallet'
      );
    });

    it('should always revert', async function () {
      fakeWalletFactory.runtimeCodeHash.returns(
        '0xbc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a'
      );

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
          tokenContract: constants.AddressZero,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.be.revertedWith('Deploy request accepted only');
    });
  });
});
