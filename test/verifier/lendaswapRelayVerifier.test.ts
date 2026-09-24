import {
  FakeContract,
  MockContract,
  MockContractFactory,
  smock,
} from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, BigNumberish, constants } from 'ethers';
import { ethers } from 'hardhat';
import {
  BoltzSmartWallet,
  BoltzSmartWalletFactory,
  ERC20,
  IHTLCNative,
  IHTLCNativeCoordinator,
  LendaswapRelayVerifier,
  LendaswapRelayVerifier__factory,
} from 'typechain-types';
import { EnvelopingTypes, RelayHub } from 'typechain-types/contracts/RelayHub';
import {
  REDEEM_METHODS,
  RedeemRequest,
  createRedeemRequest,
  getDomainSeparator,
  getPreimageHash,
} from '../utils/lendaswap';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

// Code hash shared by every smock fake, used as the smart wallet template code hash
const FAKE_RUNTIME_CODE_HASH =
  '0xbc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a';

describe('LendaswapRelayVerifier Contract', function () {
  let fakeToken: FakeContract<ERC20>;
  let fakeWalletFactory: FakeContract<BoltzSmartWalletFactory>;
  let relayVerifierFactoryMock: MockContractFactory<LendaswapRelayVerifier__factory>;
  let relayVerifierMock: MockContract<LendaswapRelayVerifier>;

  beforeEach(async function () {
    fakeToken = await smock.fake<ERC20>('ERC20');
    fakeWalletFactory = await smock.fake<BoltzSmartWalletFactory>(
      'BoltzSmartWalletFactory'
    );
    relayVerifierFactoryMock =
      await smock.mock<LendaswapRelayVerifier__factory>(
        'LendaswapRelayVerifier'
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
    let relayWorker: SignerWithAddress;
    let fakeSmartWallet: FakeContract<BoltzSmartWallet>;
    let fakeRelayHub: FakeContract<RelayHub>;
    let fakeHtlc: FakeContract<IHTLCNative>;
    let fakeCoordinator: FakeContract<IHTLCNativeCoordinator>;
    let chainId: number;

    function createRelayRequest(
      to: string,
      data: string,
      tokenAmount: BigNumberish,
      tokenContract = constants.AddressZero
    ): EnvelopingTypes.RelayRequestStruct {
      return {
        relayData: {
          callForwarder: fakeSmartWallet.address,
          callVerifier: relayVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          data,
          from: owner.address,
          to,
          gas: '1000000',
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount,
          tokenContract,
          validUntilTime: '0',
          value: '0',
        },
      };
    }

    function activateSwap({ terms, claimAddress }: RedeemRequest) {
      fakeHtlc.isActive
        .whenCalledWith(
          getPreimageHash(terms.preimage),
          terms.amount,
          constants.AddressZero,
          terms.sender,
          claimAddress,
          terms.timelock
        )
        .returns(true);
    }

    beforeEach(async function () {
      [owner, relayWorker] = (await ethers.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress
      ];
      ({ chainId } = await ethers.provider.getNetwork());
      fakeSmartWallet = await smock.fake<BoltzSmartWallet>('BoltzSmartWallet');
      fakeRelayHub = await smock.fake<RelayHub>('RelayHub');
      fakeHtlc = await smock.fake<IHTLCNative>('IHTLCNative');
      fakeCoordinator = await smock.fake<IHTLCNativeCoordinator>(
        'IHTLCNativeCoordinator'
      );

      fakeHtlc.isActive.returns(false);
      fakeHtlc.DOMAIN_SEPARATOR.returns(
        getDomainSeparator(fakeHtlc.address, chainId)
      );
      fakeCoordinator.HTLC_NATIVE.returns(fakeHtlc.address);
      fakeWalletFactory.runtimeCodeHash.returns(FAKE_RUNTIME_CODE_HASH);

      await relayVerifierMock.setVariables({
        acceptedTokens: [fakeToken.address],
        tokens: {
          [fakeToken.address]: true,
        },
        acceptedContracts: [fakeHtlc.address, fakeCoordinator.address],
        contracts: {
          [fakeHtlc.address]: true,
          [fakeCoordinator.address]: true,
        },
      });
    });

    it('should not revert if paying with ERC20 token', async function () {
      fakeToken.balanceOf.returns(BigNumber.from('200000000000'));

      const relayRequest = createRelayRequest(
        fakeHtlc.address,
        '0x00',
        '100000000000',
        fakeToken.address
      );

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.not.be.reverted;
    });

    it('should revert if smart wallet template is different than smart wallet factory', async function () {
      fakeWalletFactory.runtimeCodeHash.returns(constants.HashZero);

      const relayRequest = createRelayRequest(fakeHtlc.address, '0x00', '0');

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.be.revertedWith('SW different to template');
    });

    it('should revert if method is not allowed', async function () {
      const relayRequest = createRelayRequest(
        fakeHtlc.address,
        '0x12345678',
        '100000'
      );

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.be.revertedWith('Method not allowed');
    });

    // eslint-disable-next-line mocha/no-setup-in-describe
    REDEEM_METHODS.forEach((method) => {
      describe(`calling ${method}`, function () {
        let redeemRequest: RedeemRequest;

        beforeEach(async function () {
          redeemRequest = await createRedeemRequest({
            method,
            htlcAddress: fakeHtlc.address,
            coordinatorAddress: fakeCoordinator.address,
            smartWalletAddress: fakeSmartWallet.address,
            chainId,
          });
        });

        it('should not revert if the swap pays for the native fee', async function () {
          activateSwap(redeemRequest);
          const { to, data, terms } = redeemRequest;
          const relayRequest = createRelayRequest(to, data, terms.amount);

          const result = relayVerifierMock.verifyRelayedCall(
            relayRequest,
            '0x00'
          );
          await expect(result).to.not.be.reverted;
        });

        it('should revert if the swap is not active', async function () {
          const { to, data, terms } = redeemRequest;
          const relayRequest = createRelayRequest(to, data, terms.amount);

          const result = relayVerifierMock.verifyRelayedCall(
            relayRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Verifier: swap not active');
        });

        it('should revert if native balance is too low', async function () {
          activateSwap(redeemRequest);
          const { to, data, terms } = redeemRequest;
          const relayRequest = createRelayRequest(
            to,
            data,
            terms.amount.add(1)
          );

          const result = relayVerifierMock.verifyRelayedCall(
            relayRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Native balance too low');
        });
      });
    });
  });
});
