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
  SwapSmartWalletFactory,
  ERC20,
  IHTLCNative,
  LendaswapDeployVerifier,
  LendaswapDeployVerifier__factory,
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

const setBalance = (address: string, balance: BigNumber) =>
  ethers.provider.send('hardhat_setBalance', [
    address,
    ethers.utils.hexValue(balance),
  ]);

describe('LendaswapDeployVerifier Contract', function () {
  let fakeToken: FakeContract<ERC20>;
  let fakeWalletFactory: FakeContract<SwapSmartWalletFactory>;
  let deployVerifierFactoryMock: MockContractFactory<LendaswapDeployVerifier__factory>;
  let deployVerifierMock: MockContract<LendaswapDeployVerifier>;

  beforeEach(async function () {
    fakeToken = await smock.fake<ERC20>('ERC20');
    fakeWalletFactory = await smock.fake<SwapSmartWalletFactory>(
      'SwapSmartWalletFactory'
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

    describe('calling a method that is not a redeem', function () {
      it('should revert if paying', async function () {
        const result = deployVerifierMock.verifyRelayedCall(
          createDeployRequest(fakeHtlc.address, '0x12345678', '100000'),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert if not paying', async function () {
        const result = deployVerifierMock.verifyRelayedCall(
          createDeployRequest(fakeHtlc.address, '0x12345678', '0'),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert even if the wallet balance covers the fee', async function () {
        const balance = ethers.utils.parseEther('1');
        await setBalance(smartWalletAddress, balance);

        const result = deployVerifierMock.verifyRelayedCall(
          createDeployRequest(fakeHtlc.address, '0x12345678', balance),
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
        await setBalance(smartWalletAddress, ethers.utils.parseEther('1'));

        const result = deployVerifierMock.verifyRelayedCall(
          createDeployRequest(fakeHtlc.address, data, '100000'),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert on redeemAndExecute if paying', async function () {
        const result = deployVerifierMock.verifyRelayedCall(
          createDeployRequest(
            fakeHtlc.address,
            REDEEM_AND_EXECUTE_SELECTOR,
            '100000'
          ),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert on redeemAndExecute if not paying', async function () {
        const result = deployVerifierMock.verifyRelayedCall(
          createDeployRequest(
            fakeHtlc.address,
            REDEEM_AND_EXECUTE_SELECTOR,
            '0'
          ),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });

      it('should revert if the data is shorter than a method selector', async function () {
        const result = deployVerifierMock.verifyRelayedCall(
          createDeployRequest(fakeHtlc.address, '0x00', '0'),
          '0x00'
        );
        await expect(result).to.be.revertedWith('Method not allowed');
      });
    });

    describe('calling no contract', function () {
      beforeEach(async function () {
        await deployVerifierMock.setVariables({
          acceptedContracts: [fakeHtlc.address, constants.AddressZero],
          contracts: {
            [fakeHtlc.address]: true,
            [constants.AddressZero]: true,
          },
        });
      });

      it('should charge the fee to the wallet balance', async function () {
        const balance = ethers.utils.parseEther('1');
        await setBalance(smartWalletAddress, balance);

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(constants.AddressZero, '0x', balance),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(constants.AddressZero, '0x', balance.add(1)),
            '0x00'
          )
        ).to.be.revertedWith('Native balance too low');
      });

      it('should charge a token fee to the wallet token balance', async function () {
        fakeToken.balanceOf.returns(1000);

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(
              constants.AddressZero,
              '0x',
              1000,
              fakeToken.address
            ),
            '0x00'
          )
        ).to.not.be.reverted;
        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(
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
        await setBalance(smartWalletAddress, ethers.utils.parseEther('1'));

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(
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
        await deployVerifierMock.setVariables({
          contracts: { [constants.AddressZero]: false },
        });

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(constants.AddressZero, '0x', '0'),
            '0x00'
          )
        ).to.be.revertedWith('Destination contract not allowed');
      });

      it('should not read data that comes with no call', async function () {
        // the wallet makes no call, so the data is never used
        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(constants.AddressZero, '0x12345678', '0'),
            '0x00'
          )
        ).to.not.be.reverted;
      });
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

      it('should accept the wallet as destination and a zero calls hash, as satora signed its testnet claims', async function () {
        const { to, data, terms } = await createSignedRequest({
          callsHash: constants.HashZero,
        });

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, terms.amount),
            '0x00'
          )
        ).to.not.be.reverted;
      });

      it('should accept a signed minimum amount out', async function () {
        const { to, data, terms } = await createSignedRequest({
          minAmountOut: 1,
        });

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, data, terms.amount),
            '0x00'
          )
        ).to.not.be.reverted;
      });

      it('should revert if its arguments are cut short', async function () {
        const { to, data } = await createSignedRequest({});
        // the selector and 5 of its 11 arguments
        const cutShort = ethers.utils.hexDataSlice(data, 0, 4 + 5 * 32);

        await expect(
          deployVerifierMock.verifyRelayedCall(
            createDeployRequest(to, cutShort, '0'),
            '0x00'
          )
        ).to.be.reverted;
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

        it('should not revert if not paying, even if the swap is not active', async function () {
          const { to, data } = redeemRequest;
          const deployRequest = createDeployRequest(to, data, '0');

          const result = deployVerifierMock.verifyRelayedCall(
            deployRequest,
            '0x00'
          );
          await expect(result).to.not.be.reverted;
        });

        it('should not revert with a zero ERC20 fee, even if the swap is not active', async function () {
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
          await expect(result).to.not.be.reverted;
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

        it('should revert with a fee of 1 wei if the swap is not active', async function () {
          const { to, data } = redeemRequest;
          const deployRequest = createDeployRequest(to, data, 1);

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

    describe('calling redeemBySig', function () {
      it('should revert if the signature authorizes a different caller', async function () {
        const redeemRequest = await createRedeemRequest({
          method: 'redeemBySig',
          htlcAddress: fakeHtlc.address,
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
  });
});
