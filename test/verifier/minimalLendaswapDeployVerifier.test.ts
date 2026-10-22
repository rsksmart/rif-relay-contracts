import {
  FakeContract,
  MockContract,
  MockContractFactory,
  smock,
} from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumberish, Wallet, constants } from 'ethers';
import { ethers } from 'hardhat';
import {
  ERC20,
  IHTLCNative,
  MinimalSwapSmartWalletFactory,
  MinimalLendaswapDeployVerifier,
  MinimalLendaswapDeployVerifier__factory,
} from 'typechain-types';
import { EnvelopingTypes, RelayHub } from 'typechain-types/contracts/RelayHub';
import {
  REDEEM_AND_EXECUTE_SELECTOR,
  REDEEM_METHODS,
  RedeemAuthorization,
  RedeemRequest,
  createRedeemRequest,
  createSwapTerms,
  encodeRefundTo,
  getDomainSeparator,
  getPreimageHash,
} from '../utils/lendaswap';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe('MinimalLendaswapDeployVerifier Contract', function () {
  let fakeWalletFactory: FakeContract<MinimalSwapSmartWalletFactory>;
  let deployVerifierFactoryMock: MockContractFactory<MinimalLendaswapDeployVerifier__factory>;
  let deployVerifierMock: MockContract<MinimalLendaswapDeployVerifier>;

  beforeEach(async function () {
    fakeWalletFactory = await smock.fake<MinimalSwapSmartWalletFactory>(
      'MinimalSwapSmartWalletFactory'
    );
    deployVerifierFactoryMock =
      await smock.mock<MinimalLendaswapDeployVerifier__factory>(
        'MinimalLendaswapDeployVerifier'
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
    let relayWorker: SignerWithAddress;
    let fakeRelayHub: FakeContract<RelayHub>;
    let fakeHtlc: FakeContract<IHTLCNative>;
    let smartWalletAddress: string;
    let chainId: number;

    function createDeployRequest(
      to: string,
      data: string,
      tokenAmount: BigNumberish,
      tokenContract = constants.AddressZero,
      value: BigNumberish = 0
    ): EnvelopingTypes.DeployRequestStruct {
      return {
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
          to,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount,
          tokenContract,
          validUntilTime: '0',
          value,
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
      fakeRelayHub = await smock.fake<RelayHub>('RelayHub');
      fakeHtlc = await smock.fake<IHTLCNative>('IHTLCNative');

      fakeHtlc.isActive.returns(false);
      fakeHtlc.DOMAIN_SEPARATOR.returns(
        getDomainSeparator(fakeHtlc.address, chainId)
      );

      smartWalletAddress = Wallet.createRandom().address;
      fakeWalletFactory.getSmartWalletAddress.returns(smartWalletAddress);

      await deployVerifierMock.setVariables({
        acceptedContracts: [fakeHtlc.address],
        contracts: {
          [fakeHtlc.address]: true,
        },
      });
    });

    it('should revert if there is no contract execution', async function () {
      const deployRequest = createDeployRequest(
        constants.AddressZero,
        '0x00',
        '0'
      );

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('SW needs a contract execution');
    });

    it('should revert if method is not allowed', async function () {
      const deployRequest = createDeployRequest(
        fakeHtlc.address,
        '0x12345678',
        '0'
      );

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Method not allowed');
    });

    it('should revert on a refund paid to another address', async function () {
      // The destination runs code when HTLCNative pays it
      const data = encodeRefundTo(
        createSwapTerms({ sender: smartWalletAddress }),
        Wallet.createRandom().address
      );
      const deployRequest = createDeployRequest(fakeHtlc.address, data, '0');

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Method not allowed');
    });

    it('should revert on redeemAndExecute if paying', async function () {
      const deployRequest = createDeployRequest(
        fakeHtlc.address,
        REDEEM_AND_EXECUTE_SELECTOR,
        '1'
      );

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Method not allowed');
    });

    it('should revert on redeemAndExecute if not paying', async function () {
      const deployRequest = createDeployRequest(
        fakeHtlc.address,
        REDEEM_AND_EXECUTE_SELECTOR,
        '0'
      );

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Method not allowed');
    });

    describe('calling redeemBySig, with what else the claimant signs', function () {
      async function createSignedRequest(
        authorization: Partial<RedeemAuthorization>
      ) {
        const redeemRequest = await createRedeemRequest({
          method: 'redeemBySig',
          htlcAddress: fakeHtlc.address,
          smartWalletAddress: smartWalletAddress,
          chainId,
          authorization,
        });
        activateSwap(redeemRequest);

        return redeemRequest;
      }

      it('should accept no destination and a zero calls hash, as clients sign them', async function () {
        const { to, data, terms } = await createSignedRequest({
          destination: constants.AddressZero,
          callsHash: constants.HashZero,
        });

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, terms.amount),
            '0x00'
          )
        ).to.not.be.reverted;
      });

      it('should revert if it signs another destination, even if not paying', async function () {
        const { to, data } = await createSignedRequest({
          destination: Wallet.createRandom().address,
        });

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, '0'),
            '0x00'
          )
        ).to.be.revertedWith('Redeem authorizes other calls');
      });

      it('should revert if it signs a token sweep', async function () {
        const { to, data } = await createSignedRequest({
          sweepToken: Wallet.createRandom().address,
        });

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, '0'),
            '0x00'
          )
        ).to.be.revertedWith('Redeem authorizes other calls');
      });

      it('should revert if it signs calls', async function () {
        const { to, data } = await createSignedRequest({
          callsHash: ethers.utils.keccak256('0x1234'),
        });

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, '0'),
            '0x00'
          )
        ).to.be.revertedWith('Redeem authorizes other calls');
      });
    });

    // eslint-disable-next-line mocha/no-setup-in-describe
    REDEEM_METHODS.forEach((method) => {
      describe(`calling ${method}`, function () {
        let redeemRequest: RedeemRequest;

        beforeEach(async function () {
          redeemRequest = await createRedeemRequest({
            method,
            htlcAddress: fakeHtlc.address,
            smartWalletAddress,
            chainId,
          });
        });

        it('should not revert if the swap pays for the native fee', async function () {
          activateSwap(redeemRequest);
          const { to, data, terms } = redeemRequest;
          const deployRequest = createDeployRequest(to, data, terms.amount);

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.not.be.reverted;
        });

        it('should not revert if not paying', async function () {
          activateSwap(redeemRequest);
          const { to, data } = redeemRequest;
          const deployRequest = createDeployRequest(to, data, '0');

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.not.be.reverted;
        });

        it('should revert if the swap is not active, even if not paying', async function () {
          const { to, data } = redeemRequest;
          const deployRequest = createDeployRequest(to, data, '0');

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Verifier: swap not active');
        });

        it('should revert if paying with ERC20 token', async function () {
          activateSwap(redeemRequest);
          const { to, data, terms } = redeemRequest;
          const fakeToken = await smock.fake<ERC20>('ERC20');
          const deployRequest = createDeployRequest(
            to,
            data,
            terms.amount,
            fakeToken.address
          );

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('RBTC necessary for payment');
        });

        it('should revert if native balance is too low', async function () {
          activateSwap(redeemRequest);
          const { to, data, terms } = redeemRequest;
          const deployRequest = createDeployRequest(
            to,
            data,
            terms.amount.add(1)
          );

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Native balance too low');
        });

        it('should revert if the request forwards value', async function () {
          activateSwap(redeemRequest);
          const { to, data, terms } = redeemRequest;
          const deployRequest = createDeployRequest(
            to,
            data,
            terms.amount,
            constants.AddressZero,
            1
          );

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Value not allowed');
        });
      });
    });
  });
});
