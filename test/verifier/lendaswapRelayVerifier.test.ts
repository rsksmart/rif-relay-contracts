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
  SwapSmartWallet,
  SwapSmartWalletFactory,
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

const CALL_TARGET = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7';

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
    let fakeCoordinator: FakeContract<IHTLCNativeCoordinator>;
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

    it('should revert if smart wallet template is different than smart wallet factory', async function () {
      fakeWalletFactory.runtimeCodeHash.returns(constants.HashZero);

      const relayRequest = createRelayRequest(fakeHtlc.address, '0x00', '0');

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.be.revertedWith('SW different to template');
    });

    it('should revert if a call that is not a redeem cannot pay the fee from the wallet balance', async function () {
      const relayRequest = createRelayRequest(
        fakeHtlc.address,
        '0x12345678',
        '100000'
      );

      const result = relayVerifierMock.verifyRelayedCall(relayRequest, '0x00');
      await expect(result).to.be.revertedWith('Native balance too low');
    });

    it('should not revert if not paying', async function () {
      const result = relayVerifierMock.verifyRelayedCall(
        createRelayRequest(fakeHtlc.address, '0x12345678', '0'),
        '0x00'
      );
      await expect(result).to.not.be.reverted;
    });

    it('should charge a call that is not a redeem to the wallet balance', async function () {
      const balance = ethers.utils.parseEther('1');
      await setBalance(fakeSmartWallet.address, balance);

      await expect(
        relayVerifierMock.verifyRelayedCall(
          createRelayRequest(fakeHtlc.address, '0x12345678', balance),
          '0x00'
        )
      ).to.not.be.reverted;
      await expect(
        relayVerifierMock.verifyRelayedCall(
          createRelayRequest(fakeHtlc.address, '0x12345678', balance.add(1)),
          '0x00'
        )
      ).to.be.revertedWith('Native balance too low');
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

        if (method === 'redeemAndExecute') {
          it('should revert if the forwarded value exceeds the wallet balance', async function () {
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
            await expect(result).to.be.revertedWith('Native balance too low');
          });

          it('should credit the forwarded value swept back when there are no calls', async function () {
            activateSwap(redeemRequest);
            const { to, data, terms } = redeemRequest;
            const value = ethers.utils.parseEther('1');
            await setBalance(fakeSmartWallet.address, value);

            await expect(
              relayVerifierMock.verifyRelayedCall(
                createRelayRequest(
                  to,
                  data,
                  terms.amount.add(value),
                  constants.AddressZero,
                  value
                ),
                '0x00'
              )
            ).to.not.be.reverted;
            await expect(
              relayVerifierMock.verifyRelayedCall(
                createRelayRequest(
                  to,
                  data,
                  terms.amount.add(value).add(1),
                  constants.AddressZero,
                  value
                ),
                '0x00'
              )
            ).to.be.revertedWith('Native balance too low');
          });
        } else {
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
        }
      });
    });

    describe('calling redeemAndExecute', function () {
      const calls = [
        {
          target: CALL_TARGET,
          value: 0,
          callData: '0x1234',
        },
      ];

      async function createCoordinatorRequest(
        args: Partial<Parameters<typeof createRedeemRequest>[0]> = {}
      ) {
        return createRedeemRequest({
          method: 'redeemAndExecute',
          htlcAddress: fakeHtlc.address,
          coordinatorAddress: fakeCoordinator.address,
          smartWalletAddress: fakeSmartWallet.address,
          chainId,
          ...args,
        });
      }

      it('should credit the wallet token balance when there are calls', async function () {
        const balance = ethers.utils.parseEther('1');
        const redeemRequest = await createCoordinatorRequest({ calls });
        activateSwap(redeemRequest);
        fakeToken.balanceOf.returns(balance);
        const { to, data } = redeemRequest;

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, balance, fakeToken.address),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, balance.add(1), fakeToken.address),
            '0x00'
          )
        ).to.be.revertedWith('Token balance too low');
      });

      it('should credit minAmountOut of the swept token when it pays the fee', async function () {
        const minAmountOut = ethers.utils.parseEther('0.1');
        const redeemRequest = await createCoordinatorRequest({
          calls,
          authorization: { sweepToken: fakeToken.address, minAmountOut },
        });
        activateSwap(redeemRequest);
        fakeToken.balanceOf.returns(0);
        const { to, data } = redeemRequest;

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, minAmountOut, fakeToken.address),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(
              to,
              data,
              minAmountOut.add(1),
              fakeToken.address
            ),
            '0x00'
          )
        ).to.be.revertedWith('Token balance too low');
      });

      it('should credit only the wallet balance when the sweep leaves the smart wallet', async function () {
        const balance = ethers.utils.parseEther('1');
        const redeemRequest = await createCoordinatorRequest({
          authorization: { destination: owner.address },
        });
        activateSwap(redeemRequest);
        const { to, data } = redeemRequest;
        await setBalance(fakeSmartWallet.address, balance);

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, balance),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, balance.add(1)),
            '0x00'
          )
        ).to.be.revertedWith('Native balance too low');
      });

      it('should credit only the wallet balance when the sweep is a token', async function () {
        const balance = ethers.utils.parseEther('1');
        const redeemRequest = await createCoordinatorRequest({
          authorization: { sweepToken: fakeToken.address },
        });
        activateSwap(redeemRequest);
        const { to, data } = redeemRequest;
        await setBalance(fakeSmartWallet.address, balance);

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, balance),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, balance.add(1)),
            '0x00'
          )
        ).to.be.revertedWith('Native balance too low');
      });

      it('should credit the wallet balance when there are calls', async function () {
        const minAmountOut = ethers.utils.parseEther('0.1');
        const balance = ethers.utils.parseEther('1');
        const redeemRequest = await createCoordinatorRequest({
          calls,
          authorization: { minAmountOut },
        });
        activateSwap(redeemRequest);
        const { to, data } = redeemRequest;
        await setBalance(fakeSmartWallet.address, balance);

        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, balance.add(minAmountOut)),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          relayVerifierMock.verifyRelayedCall(
            createRelayRequest(to, data, balance.add(minAmountOut).add(1)),
            '0x00'
          )
        ).to.be.revertedWith('Native balance too low');
      });
    });
  });
});
