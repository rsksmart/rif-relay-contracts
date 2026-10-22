import {
  FakeContract,
  MockContract,
  MockContractFactory,
  smock,
} from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, BigNumberish, Wallet, constants } from 'ethers';
import { ethers } from 'hardhat';
import {
  SwapSmartWallet,
  SwapSmartWalletFactory,
  ERC20,
  IHTLCNative,
  LendaswapRelayVerifier,
  LendaswapRelayVerifier__factory,
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

// Code hash shared by every smock fake, used as the smart wallet template code hash
const FAKE_RUNTIME_CODE_HASH =
  '0xbc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a';

const setBalance = (address: string, balance: BigNumber) =>
  ethers.provider.send('hardhat_setBalance', [
    address,
    ethers.utils.hexValue(balance),
  ]);

describe('LendaswapRelayVerifier Contract', function () {
  let fakeToken: FakeContract<ERC20>;
  let fakeWalletFactory: FakeContract<SwapSmartWalletFactory>;
  let relayVerifierFactoryMock: MockContractFactory<LendaswapRelayVerifier__factory>;
  let relayVerifierMock: MockContract<LendaswapRelayVerifier>;

  beforeEach(async function () {
    fakeToken = await smock.fake<ERC20>('ERC20');
    fakeWalletFactory = await smock.fake<SwapSmartWalletFactory>(
      'SwapSmartWalletFactory'
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
    let fakeSmartWallet: FakeContract<SwapSmartWallet>;
    let fakeRelayHub: FakeContract<RelayHub>;
    let fakeHtlc: FakeContract<IHTLCNative>;
    let chainId: number;

    function createRelayRequest(
      to: string,
      data: string,
      tokenAmount: BigNumberish,
      tokenContract = constants.AddressZero,
      value: BigNumberish = 0
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
      fakeSmartWallet = await smock.fake<SwapSmartWallet>('SwapSmartWallet');
      fakeRelayHub = await smock.fake<RelayHub>('RelayHub');
      fakeHtlc = await smock.fake<IHTLCNative>('IHTLCNative');

      fakeHtlc.isActive.returns(false);
      fakeHtlc.DOMAIN_SEPARATOR.returns(
        getDomainSeparator(fakeHtlc.address, chainId)
      );
      fakeWalletFactory.runtimeCodeHash.returns(FAKE_RUNTIME_CODE_HASH);

      await relayVerifierMock.setVariables({
        acceptedTokens: [fakeToken.address],
        tokens: {
          [fakeToken.address]: true,
        },
        acceptedContracts: [fakeHtlc.address],
        contracts: {
          [fakeHtlc.address]: true,
        },
      });
    });

    it('should revert if smart wallet template is different than smart wallet factory', async function () {
      fakeWalletFactory.runtimeCodeHash.returns(constants.HashZero);

      const relayRequest = createRelayRequest(fakeHtlc.address, '0x00', '0');

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.be.revertedWith('SW different to template');
    });

    describe('calling a method that is not a redeem', function () {
      it('should revert if paying', async function () {
        const result = relayVerifierMock.verifyRelayedCall(
          createRelayRequest(fakeHtlc.address, '0x12345678', '100000'),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert if not paying', async function () {
        const result = relayVerifierMock.verifyRelayedCall(
          createRelayRequest(fakeHtlc.address, '0x12345678', '0'),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert even if the wallet balance covers the fee', async function () {
        const balance = ethers.utils.parseEther('1');
        await setBalance(fakeSmartWallet.address, balance);

        const result = relayVerifierMock.verifyRelayedCall(
          createRelayRequest(fakeHtlc.address, '0x12345678', balance),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert on a refund paid to another address', async function () {
        // The destination runs code when HTLCNative pays it
        const data = encodeRefundTo(
          createSwapTerms({ sender: fakeSmartWallet.address }),
          Wallet.createRandom().address
        );
        await setBalance(fakeSmartWallet.address, ethers.utils.parseEther('1'));

        const result = relayVerifierMock.verifyRelayedCall(
          createRelayRequest(fakeHtlc.address, data, '100000'),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert on redeemAndExecute if paying', async function () {
        const result = relayVerifierMock.verifyRelayedCall(
          createRelayRequest(
            fakeHtlc.address,
            REDEEM_AND_EXECUTE_SELECTOR,
            '100000'
          ),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert on redeemAndExecute if not paying', async function () {
        const result = relayVerifierMock.verifyRelayedCall(
          createRelayRequest(
            fakeHtlc.address,
            REDEEM_AND_EXECUTE_SELECTOR,
            '0'
          ),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert if the data is shorter than a method selector', async function () {
        const result = relayVerifierMock.verifyRelayedCall(
          createRelayRequest(fakeHtlc.address, '0x00', '0'),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });
    });

    describe('calling no contract', function () {
      beforeEach(async function () {
        await relayVerifierMock.setVariables({
          acceptedContracts: [fakeHtlc.address, constants.AddressZero],
          contracts: {
            [fakeHtlc.address]: true,
            [constants.AddressZero]: true,
          },
        });
      });

      it('should charge the fee to the wallet balance', async function () {
        const balance = ethers.utils.parseEther('1');
        await setBalance(fakeSmartWallet.address, balance);

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(constants.AddressZero, '0x', balance),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(constants.AddressZero, '0x', balance.add(1)),
            '0x00'
          )
        ).to.be.revertedWith('Native balance too low');
      });

      it('should charge a token fee to the wallet token balance', async function () {
        fakeToken.balanceOf.returns(1000);

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(
              constants.AddressZero,
              '0x',
              1000,
              fakeToken.address
            ),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(
              constants.AddressZero,
              '0x',
              1001,
              fakeToken.address
            ),
            '0x00'
          )
        ).to.be.revertedWith('Token balance too low');
      });

      it('should revert if the request forwards value', async function () {
        await setBalance(fakeSmartWallet.address, ethers.utils.parseEther('1'));

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(
              constants.AddressZero,
              '0x',
              '0',
              constants.AddressZero,
              1
            ),
            '0x00'
          )
        ).to.be.revertedWith('Value not allowed');
      });

      it('should revert unless address(0) is an allowed destination', async function () {
        await relayVerifierMock.setVariables({
          contracts: { [constants.AddressZero]: false },
        });

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(constants.AddressZero, '0x', '0'),
            '0x00'
          )
        ).to.be.revertedWith('Destination contract not allowed');
      });
    });

    describe('calling redeemBySig, with what else the claimant signs', function () {
      async function createSignedRequest(
        authorization: Partial<RedeemAuthorization>
      ) {
        const redeemRequest = await createRedeemRequest({
          method: 'redeemBySig',
          htlcAddress: fakeHtlc.address,
          smartWalletAddress: fakeSmartWallet.address,
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
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, terms.amount),
            '0x00'
          )
        ).to.not.be.reverted;
      });

      it('should revert if it signs another destination, even if not paying', async function () {
        const { to, data } = await createSignedRequest({
          destination: Wallet.createRandom().address,
        });

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, '0'),
            '0x00'
          )
        ).to.be.revertedWith('Redeem authorizes other calls');
      });

      it('should revert if it signs a token sweep', async function () {
        const { to, data } = await createSignedRequest({
          sweepToken: Wallet.createRandom().address,
        });

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, '0'),
            '0x00'
          )
        ).to.be.revertedWith('Redeem authorizes other calls');
      });

      it('should revert if it signs calls', async function () {
        const { to, data } = await createSignedRequest({
          callsHash: ethers.utils.keccak256('0x1234'),
        });

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, '0'),
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

        it('should not revert if paying with ERC20 token', async function () {
          activateSwap(redeemRequest);
          fakeToken.balanceOf.returns(BigNumber.from('200000000000'));
          const { to, data } = redeemRequest;
          const relayRequest = createRelayRequest(
            to,
            data,
            '100000000000',
            fakeToken.address
          );

          const result = relayVerifierMock.verifyRelayedCall(
            relayRequest,
            '0x00'
          );
          await expect(result).to.not.be.reverted;
        });

        it('should revert if the swap is not active when paying with ERC20 token', async function () {
          fakeToken.balanceOf.returns(BigNumber.from('200000000000'));
          const { to, data } = redeemRequest;
          const relayRequest = createRelayRequest(
            to,
            data,
            '100000000000',
            fakeToken.address
          );

          const result = relayVerifierMock.verifyRelayedCall(
            relayRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Verifier: swap not active');
        });

        it('should not revert if not paying', async function () {
          activateSwap(redeemRequest);
          const { to, data } = redeemRequest;
          const relayRequest = createRelayRequest(to, data, '0');

          const result = relayVerifierMock.verifyRelayedCall(
            relayRequest,
            '0x00'
          );
          await expect(result).to.not.be.reverted;
        });

        it('should not revert if not paying, even if the swap is not active', async function () {
          const { to, data } = redeemRequest;
          const relayRequest = createRelayRequest(to, data, '0');

          const result = relayVerifierMock.verifyRelayedCall(
            relayRequest,
            '0x00'
          );
          await expect(result).to.not.be.reverted;
        });

        it('should not revert with a zero ERC20 fee, even if the swap is not active', async function () {
          const { to, data } = redeemRequest;
          const relayRequest = createRelayRequest(
            to,
            data,
            '0',
            fakeToken.address
          );

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

        it('should revert if the request forwards value', async function () {
          activateSwap(redeemRequest);
          const { to, data, terms } = redeemRequest;
          const relayRequest = createRelayRequest(
            to,
            data,
            terms.amount,
            constants.AddressZero,
            1
          );

          const result = relayVerifierMock.verifyRelayedCall(
            relayRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Value not allowed');
        });
      });
    });
  });
});
