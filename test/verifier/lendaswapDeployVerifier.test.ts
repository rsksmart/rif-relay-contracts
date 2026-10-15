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
  BoltzSmartWalletFactory,
  ERC20,
  IHTLCNative,
  IHTLCNativeCoordinator,
  LendaswapDeployVerifier,
  LendaswapDeployVerifier__factory,
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

const CALL_TARGET = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7';

const setBalance = (address: string, balance: BigNumber) =>
  ethers.provider.send('hardhat_setBalance', [
    address,
    ethers.utils.hexValue(balance),
  ]);

describe('LendaswapDeployVerifier Contract', function () {
  let fakeToken: FakeContract<ERC20>;
  let fakeWalletFactory: FakeContract<BoltzSmartWalletFactory>;
  let deployVerifierFactoryMock: MockContractFactory<LendaswapDeployVerifier__factory>;
  let deployVerifierMock: MockContract<LendaswapDeployVerifier>;

  beforeEach(async function () {
    fakeToken = await smock.fake<ERC20>('ERC20');
    fakeWalletFactory = await smock.fake<BoltzSmartWalletFactory>(
      'BoltzSmartWalletFactory'
    );
    deployVerifierFactoryMock =
      await smock.mock<LendaswapDeployVerifier__factory>(
        'LendaswapDeployVerifier'
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
    let fakeCoordinator: FakeContract<IHTLCNativeCoordinator>;
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
      fakeCoordinator = await smock.fake<IHTLCNativeCoordinator>(
        'IHTLCNativeCoordinator'
      );

      fakeHtlc.isActive.returns(false);
      fakeHtlc.DOMAIN_SEPARATOR.returns(
        getDomainSeparator(fakeHtlc.address, chainId)
      );
      fakeCoordinator.HTLC_NATIVE.returns(fakeHtlc.address);

      smartWalletAddress = Wallet.createRandom().address;
      fakeWalletFactory.getSmartWalletAddress.returns(smartWalletAddress);

      await deployVerifierMock.setVariables({
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

    it('should revert if not paying for a call that is not a redeem', async function () {
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

    it('should revert if destination contract is not allowed', async function () {
      const notAllowed = await smock.fake<IHTLCNative>('IHTLCNative');
      const deployRequest = createDeployRequest(
        notAllowed.address,
        '0x00',
        '0'
      );

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith(
        'Destination contract not allowed'
      );
    });

    it('should revert if method is not allowed', async function () {
      const abiInterface = new ethers.utils.Interface([
        'function claim(bytes32 preimage, uint amount, address refundAddress, uint timelock)',
      ]);
      const data = abiInterface.encodeFunctionData('claim', [
        constants.HashZero,
        ethers.utils.parseEther('0.5'),
        constants.AddressZero,
        500,
      ]);
      const deployRequest = createDeployRequest(
        fakeHtlc.address,
        data,
        '100000'
      );

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
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

        it('should look up the swap with the expected claim address', async function () {
          activateSwap(redeemRequest);
          const { to, data, terms, claimAddress } = redeemRequest;
          const deployRequest = createDeployRequest(to, data, terms.amount);

          await deployVerifierMock.verifyRelayedCall(deployRequest, '0x00');

          expect(fakeHtlc.isActive).to.have.been.calledWith(
            getPreimageHash(terms.preimage),
            terms.amount,
            constants.AddressZero,
            terms.sender,
            claimAddress,
            terms.timelock
          );
        });

        it('should not revert if paying with ERC20 token', async function () {
          activateSwap(redeemRequest);
          fakeToken.balanceOf.returns(BigNumber.from('200000000000'));
          const { to, data } = redeemRequest;
          const deployRequest = createDeployRequest(
            to,
            data,
            '100000000000',
            fakeToken.address
          );

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.not.be.reverted;
        });

        it('should revert if the swap is not active when paying with ERC20 token', async function () {
          fakeToken.balanceOf.returns(BigNumber.from('200000000000'));
          const { to, data } = redeemRequest;
          const deployRequest = createDeployRequest(
            to,
            data,
            '100000000000',
            fakeToken.address
          );

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Verifier: swap not active');
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

        it('should revert if the swap is not active, even with a zero ERC20 fee', async function () {
          const { to, data } = redeemRequest;
          const deployRequest = createDeployRequest(
            to,
            data,
            '0',
            fakeToken.address
          );

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Verifier: swap not active');
        });

        it('should revert if the swap is not active', async function () {
          const { to, data, terms } = redeemRequest;
          const deployRequest = createDeployRequest(to, data, terms.amount);

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.be.revertedWith('Verifier: swap not active');
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

        if (method === 'redeemAndExecute') {
          it('should revert if the forwarded value exceeds the wallet balance', async function () {
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
            await expect(result).to.be.revertedWith('Native balance too low');
          });

          it('should credit the forwarded value swept back when there are no calls', async function () {
            activateSwap(redeemRequest);
            const { to, data, terms } = redeemRequest;
            const value = ethers.utils.parseEther('1');
            await setBalance(smartWalletAddress, value);

            await expect(
              deployVerifierMock.verifyRelayedCall(
                createDeployRequest(
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
              deployVerifierMock.verifyRelayedCall(
                createDeployRequest(
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
        }
      });
    });

    describe('calling redeemBySig', function () {
      it('should revert if the signature authorizes a different caller', async function () {
        const redeemRequest = await createRedeemRequest({
          method: 'redeemBySig',
          htlcAddress: fakeHtlc.address,
          coordinatorAddress: fakeCoordinator.address,
          smartWalletAddress,
          chainId,
          authorization: { caller: Wallet.createRandom().address },
        });
        activateSwap(redeemRequest);
        const { to, data, terms } = redeemRequest;
        const deployRequest = createDeployRequest(to, data, terms.amount);

        const result = deployVerifierMock.verifyRelayedCall(
          deployRequest,
          '0x00'
        );
        await expect(result).to.be.revertedWith('Verifier: swap not active');
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
          smartWalletAddress,
          chainId,
          ...args,
        });
      }

      it('should credit only minAmountOut when there are calls', async function () {
        const minAmountOut = ethers.utils.parseEther('0.1');
        const redeemRequest = await createCoordinatorRequest({
          calls,
          authorization: { minAmountOut },
        });
        activateSwap(redeemRequest);
        const { to, data } = redeemRequest;

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, minAmountOut),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, minAmountOut.add(1)),
            '0x00'
          )
        ).to.be.revertedWith('Native balance too low');
      });

      it('should not credit the wallet balance when there are calls', async function () {
        const minAmountOut = ethers.utils.parseEther('0.1');
        const redeemRequest = await createCoordinatorRequest({
          calls,
          authorization: { minAmountOut },
        });
        activateSwap(redeemRequest);
        const { to, data } = redeemRequest;
        await setBalance(smartWalletAddress, ethers.utils.parseEther('1'));

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, minAmountOut),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, minAmountOut.add(1)),
            '0x00'
          )
        ).to.be.revertedWith('Native balance too low');
      });

      it('should not credit the wallet token balance when there are calls', async function () {
        const redeemRequest = await createCoordinatorRequest({ calls });
        activateSwap(redeemRequest);
        fakeToken.balanceOf.returns(ethers.utils.parseEther('1'));
        const { to, data } = redeemRequest;
        const deployRequest = createDeployRequest(
          to,
          data,
          1,
          fakeToken.address
        );

        const result = deployVerifierMock.verifyRelayedCall(
          deployRequest,
          '0x00'
        );
        await expect(result).to.be.revertedWith('Token balance too low');
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
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, minAmountOut, fakeToken.address),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(
              to,
              data,
              minAmountOut.add(1),
              fakeToken.address
            ),
            '0x00'
          )
        ).to.be.revertedWith('Token balance too low');
      });

      it('should not credit the wallet balance when the sweep leaves the smart wallet', async function () {
        const redeemRequest = await createCoordinatorRequest({
          authorization: { destination: owner.address },
        });
        activateSwap(redeemRequest);
        const { to, data } = redeemRequest;
        await setBalance(smartWalletAddress, ethers.utils.parseEther('1'));

        const result = deployVerifierMock.verifyRelayedCall(
          createDeployRequest(to, data, 1),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Native balance too low');
      });

      it('should not credit the wallet balance when the sweep is a token', async function () {
        const redeemRequest = await createCoordinatorRequest({
          authorization: { sweepToken: fakeToken.address },
        });
        activateSwap(redeemRequest);
        const { to, data } = redeemRequest;
        await setBalance(smartWalletAddress, ethers.utils.parseEther('1'));

        const result = deployVerifierMock.verifyRelayedCall(
          createDeployRequest(to, data, 1),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Native balance too low');
      });

      it('should revert if the signature authorizes the smart wallet as caller', async function () {
        const redeemRequest = await createCoordinatorRequest({
          authorization: { caller: smartWalletAddress },
        });
        activateSwap(redeemRequest);
        const { to, data, terms } = redeemRequest;
        const deployRequest = createDeployRequest(to, data, terms.amount);

        const result = deployVerifierMock.verifyRelayedCall(
          deployRequest,
          '0x00'
        );
        await expect(result).to.be.revertedWith('Verifier: swap not active');
      });

      it('should revert if the destination is the HTLC instead of the coordinator', async function () {
        const redeemRequest = await createCoordinatorRequest();
        activateSwap(redeemRequest);
        const { data, terms } = redeemRequest;
        const deployRequest = createDeployRequest(
          fakeHtlc.address,
          data,
          terms.amount
        );

        const result = deployVerifierMock.verifyRelayedCall(
          deployRequest,
          '0x00'
        );
        await expect(result).to.be.reverted;
      });
    });
  });
});
