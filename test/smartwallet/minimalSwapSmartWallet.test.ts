import { FakeContract, smock } from '@defi-wonderland/smock';
import { BaseProvider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumberish, Wallet } from 'ethers';
import { ethers as hardhat } from 'hardhat';
import {
  MinimalBoltzSmartWalletFactory,
  MinimalSwapSmartWallet__factory,
} from 'typechain-types';
import { LENDASWAP_REDEEM_METHODS } from '../../tasks/deployers';
import {
  getLocalEip712DeploySignature,
  TypedDeployRequestData,
} from '../utils/EIP712Utils';
import {
  HTLC_NATIVE_ABI,
  HTLC_NATIVE_COORDINATOR_ABI,
  REDEEM_METHODS,
  createRedeemRequest,
} from '../utils/lendaswap';
import { createDeployRequest, getSuffixData, HARDHAT_CHAIN_ID } from './utils';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = hardhat.constants.AddressZero;

const BOLTZ_CLAIM_ABI = [
  'function claim(bytes32 preimage, uint amount, address refundAddress, uint timelock)',
];
const BOLTZ_CLAIM_METHODS = ['0xc3c37fbc', '0xcd413efa'];

describe('MinimalSwapSmartWallet contract', function () {
  let smartWalletTemplateFactory: MinimalSwapSmartWallet__factory;

  beforeEach(async function () {
    smartWalletTemplateFactory = await hardhat.getContractFactory(
      'MinimalSwapSmartWallet'
    );
  });

  describe('constructor', function () {
    it('Should store the allowed methods', async function () {
      const template = await smartWalletTemplateFactory.deploy(
        LENDASWAP_REDEEM_METHODS
      );

      expect(await template.getAllowedMethods()).to.deep.equal(
        LENDASWAP_REDEEM_METHODS
      );
    });

    it('Should accept up to 8 allowed methods', async function () {
      const allowedMethods = [...Array(8).keys()].map((i) =>
        hardhat.utils.hexZeroPad(hardhat.utils.hexlify(i + 1), 4)
      );
      const template = await smartWalletTemplateFactory.deploy(allowedMethods);

      expect(await template.getAllowedMethods()).to.deep.equal(allowedMethods);
    });

    it('Should revert if there are no allowed methods', async function () {
      await expect(smartWalletTemplateFactory.deploy([])).to.be.revertedWith(
        'Invalid allowed methods length'
      );
    });

    it('Should revert if there are more than 8 allowed methods', async function () {
      const allowedMethods = [...Array(9).keys()].map((i) =>
        hardhat.utils.hexZeroPad(hardhat.utils.hexlify(i + 1), 4)
      );

      await expect(
        smartWalletTemplateFactory.deploy(allowedMethods)
      ).to.be.revertedWith('Invalid allowed methods length');
    });

    it('Should revert if an allowed method is empty', async function () {
      await expect(
        smartWalletTemplateFactory.deploy([
          LENDASWAP_REDEEM_METHODS[0],
          '0x00000000',
        ])
      ).to.be.revertedWith('Invalid allowed method');
    });
  });

  describe('isAllowedMethod()', function () {
    it('Should return true only for the allowed methods', async function () {
      const template = await smartWalletTemplateFactory.deploy(
        LENDASWAP_REDEEM_METHODS
      );

      for (const method of LENDASWAP_REDEEM_METHODS) {
        expect(await template.isAllowedMethod(method)).to.be.true;
      }
      expect(await template.isAllowedMethod(BOLTZ_CLAIM_METHODS[0])).to.be
        .false;
      expect(await template.isAllowedMethod('0x00000000')).to.be.false;
    });
  });

  describe('Function initialize()', function () {
    let smartWalletFactory: MinimalBoltzSmartWalletFactory;
    let provider: BaseProvider;
    let owner: Wallet;
    let worker: Wallet;
    let relayHub: SignerWithAddress;
    let smartWalletAddress: string;

    async function createSmartWalletFactory(allowedMethods: string[]) {
      const smartWalletTemplate = await smartWalletTemplateFactory.deploy(
        allowedMethods
      );

      const smartWalletFactoryFactory = await hardhat.getContractFactory(
        'MinimalBoltzSmartWalletFactory'
      );

      smartWalletFactory = await smartWalletFactoryFactory
        .connect(owner)
        .deploy(smartWalletTemplate.address);

      smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
        owner.address,
        ZERO_ADDRESS,
        0
      );
    }

    function relayDeploy(to: string, data: string, tokenAmount: BigNumberish) {
      const deployRequest = createDeployRequest({
        relayHub: relayHub.address,
        from: owner.address,
        nonce: '0',
        tokenGas: '5000',
        tokenAmount: tokenAmount.toString(),
        tokenContract: ZERO_ADDRESS,
        to,
        data,
      });

      const typedDeployData = new TypedDeployRequestData(
        HARDHAT_CHAIN_ID,
        smartWalletFactory.address,
        deployRequest
      );

      const suffixData = getSuffixData(typedDeployData);

      const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
      const signature = getLocalEip712DeploySignature(
        typedDeployData,
        privateKey
      );

      return smartWalletFactory
        .connect(relayHub)
        .relayedUserSmartWalletCreation(
          deployRequest.request,
          suffixData,
          worker.address,
          signature
        );
    }

    beforeEach(async function () {
      let fundedAccount: SignerWithAddress;
      [relayHub, fundedAccount] = (await hardhat.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress
      ];

      provider = hardhat.provider;
      owner = hardhat.Wallet.createRandom().connect(provider);
      worker = hardhat.Wallet.createRandom().connect(provider);

      //Fund the owner
      await fundedAccount.sendTransaction({
        to: owner.address,
        value: hardhat.utils.parseEther('1'),
      });
    });

    describe('with the lendaswap redeem methods', function () {
      let fakeHtlc: FakeContract;
      let fakeCoordinator: FakeContract;

      beforeEach(async function () {
        await createSmartWalletFactory(LENDASWAP_REDEEM_METHODS);

        fakeHtlc = await smock.fake(HTLC_NATIVE_ABI);
        fakeCoordinator = await smock.fake(HTLC_NATIVE_COORDINATOR_ABI);
      });

      // eslint-disable-next-line mocha/no-setup-in-describe
      REDEEM_METHODS.forEach((method) => {
        it(`Should pay for deployment using native (${method})`, async function () {
          const { to, data } = await createRedeemRequest({
            method,
            htlcAddress: fakeHtlc.address,
            coordinatorAddress: fakeCoordinator.address,
            smartWalletAddress,
            chainId: HARDHAT_CHAIN_ID,
          });
          const amountToBePaid = hardhat.utils.parseEther('0.01');

          // The fake does not pay the swap, so the wallet is funded in advance
          await owner.sendTransaction({
            to: smartWalletAddress,
            value: amountToBePaid,
          });

          const balanceBefore = await provider.getBalance(worker.address);

          await relayDeploy(to, data, amountToBePaid);

          const balanceAfter = await provider.getBalance(worker.address);

          expect(balanceAfter).to.be.equal(balanceBefore.add(amountToBePaid));
          const recipient =
            to === fakeHtlc.address ? fakeHtlc : fakeCoordinator;
          expect(recipient[method], 'Recipient method was not called').to.be
            .called;
        });
      });

      it('Should transfer the remaining balance to the owner', async function () {
        const { to, data } = await createRedeemRequest({
          method: 'redeem',
          htlcAddress: fakeHtlc.address,
          coordinatorAddress: fakeCoordinator.address,
          smartWalletAddress,
          chainId: HARDHAT_CHAIN_ID,
        });
        const amountToBePaid = hardhat.utils.parseEther('0.01');
        const remaining = hardhat.utils.parseEther('0.02');

        await owner.sendTransaction({
          to: smartWalletAddress,
          value: amountToBePaid.add(remaining),
        });

        const ownerBalanceBefore = await provider.getBalance(owner.address);

        await relayDeploy(to, data, amountToBePaid);

        const ownerBalanceAfter = await provider.getBalance(owner.address);

        expect(ownerBalanceAfter).to.be.equal(
          ownerBalanceBefore.add(remaining)
        );
        expect(await provider.getBalance(smartWalletAddress)).to.be.equal(0);
      });

      it('Should fail if contract execution fail', async function () {
        fakeHtlc['redeem'].reverts();

        const { to, data } = await createRedeemRequest({
          method: 'redeem',
          htlcAddress: fakeHtlc.address,
          coordinatorAddress: fakeCoordinator.address,
          smartWalletAddress,
          chainId: HARDHAT_CHAIN_ID,
        });

        await expect(relayDeploy(to, data, 0)).to.be.rejectedWith(
          'Unable to execute'
        );
      });

      it('Should fail if method is not allowed', async function () {
        const data = new hardhat.utils.Interface(
          BOLTZ_CLAIM_ABI
        ).encodeFunctionData('claim', [
          hardhat.constants.HashZero,
          hardhat.utils.parseEther('0.5'),
          ZERO_ADDRESS,
          500,
        ]);

        await expect(relayDeploy(fakeHtlc.address, data, 0)).to.be.rejectedWith(
          'Method not allowed'
        );
      });

      it('Should fail if data is shorter than a method selector', async function () {
        await expect(
          relayDeploy(fakeHtlc.address, '0x00', 0)
        ).to.be.rejectedWith('Method not allowed');
      });
    });

    describe('with the boltz claim methods', function () {
      it('Should pay for deployment using native', async function () {
        await createSmartWalletFactory(BOLTZ_CLAIM_METHODS);
        const fakeSwap = await smock.fake(BOLTZ_CLAIM_ABI);
        const data = new hardhat.utils.Interface(
          BOLTZ_CLAIM_ABI
        ).encodeFunctionData('claim', [
          hardhat.constants.HashZero,
          hardhat.utils.parseEther('0.5'),
          ZERO_ADDRESS,
          500,
        ]);
        const amountToBePaid = hardhat.utils.parseEther('0.01');

        await owner.sendTransaction({
          to: smartWalletAddress,
          value: amountToBePaid,
        });

        await relayDeploy(fakeSwap.address, data, amountToBePaid);

        expect(await provider.getBalance(worker.address)).to.be.equal(
          amountToBePaid
        );
        expect(fakeSwap['claim'], 'Recipient method was not called').to.be
          .called;
      });
    });
  });
});
