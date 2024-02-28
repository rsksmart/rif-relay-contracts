import { FakeContract, smock } from '@defi-wonderland/smock';
import { BaseProvider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Wallet } from 'ethers';
import { ethers as hardhat } from 'hardhat';
import {
  ERC20,
  MinimalBoltzSmartWalletFactory,
  SmartWallet,
} from 'typechain-types';
import {
  getLocalEip712DeploySignature,
  TypedDeployRequestData,
} from '../utils/EIP712Utils';
import { createDeployRequest, getSuffixData, HARDHAT_CHAIN_ID } from './utils';
import { deployContract } from '../../utils/deployment/deployment.utils';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = hardhat.constants.AddressZero;

describe('MinimalBoltzSmartWallet contract', function () {
  let smartWalletFactory: MinimalBoltzSmartWalletFactory;
  let provider: BaseProvider;
  let owner: Wallet;
  let relayHub: SignerWithAddress;
  let fakeToken: FakeContract<ERC20>;

  async function createSmartWalletFactory(owner: Wallet) {
    const smartWalletTemplateFactory = await hardhat.getContractFactory(
      'MinimalBoltzSmartWallet'
    );

    const smartWalletTemplate = await smartWalletTemplateFactory.deploy();

    const smartWalletFactoryFactory = await hardhat.getContractFactory(
      'MinimalBoltzSmartWalletFactory'
    );

    smartWalletFactory = await smartWalletFactoryFactory
      .connect(owner)
      .deploy(smartWalletTemplate.address);
  }

  //This function is being tested as an integration test because of the lack of tools to unit test it
  describe('Function initialize()', function () {
    let worker: Wallet;

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
      await createSmartWalletFactory(owner);

      fakeToken = await smock.fake('ERC20');
    });

    describe('with contract execution', function () {
      let recipient: FakeContract<SmartWallet>;
      let recipientFunction: string;

      beforeEach(async function () {
        recipient = await smock.fake('SmartWallet');
        recipient.isInitialized.returns(true);

        recipientFunction = recipient.interface.encodeFunctionData(
          'isInitialized',
          []
        );
      });

      it('Should pay for deployment using native', async function () {
        const amountToBePaid = hardhat.utils.parseEther('0.01');
        const deployRequest = createDeployRequest({
          relayHub: relayHub.address,
          from: owner.address,
          nonce: '0',
          tokenGas: '5000',
          tokenAmount: amountToBePaid.toString(),
          tokenContract: ZERO_ADDRESS,
          to: recipient.address,
          data: recipientFunction,
        });

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        const smartWalletAddress =
          await smartWalletFactory.getSmartWalletAddress(
            owner.address,
            ZERO_ADDRESS,
            0
          );
        await owner.sendTransaction({
          to: smartWalletAddress,
          value: amountToBePaid,
        });

        const balanceBefore = await provider.getBalance(worker.address);

        await smartWalletFactory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          );

        const balanceAfter = await provider.getBalance(worker.address);

        expect(balanceAfter).to.be.equal(balanceBefore.add(amountToBePaid));
        expect(recipient.isInitialized, 'Recipient method was not called').to.be
          .called;
      });

      it('Should not pay on sponsored deployment', async function () {
        const deployRequest = createDeployRequest({
          relayHub: relayHub.address,
          from: owner.address,
          nonce: '0',
          tokenGas: '0',
          tokenAmount: '0',
          tokenContract: fakeToken.address,
          to: recipient.address,
          data: recipientFunction,
        });

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        const workerBalanceBefore = await provider.getBalance(worker.address);

        await smartWalletFactory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          );

        const workerBalanceAfter = await provider.getBalance(worker.address);

        expect(workerBalanceBefore).to.be.equal(workerBalanceAfter);
        expect(recipient.isInitialized, 'Recipient method was not called').to.be
          .called;
      });

      it('Should fail if contract execution fail', async function () {
        const deployRequest = createDeployRequest({
          relayHub: relayHub.address,
          from: owner.address,
          nonce: '0',
          tokenGas: '0',
          tokenAmount: '0',
          tokenContract: fakeToken.address,
          to: recipient.address,
          data: recipientFunction,
        });

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        recipient.isInitialized.reverts();

        await expect(
          smartWalletFactory
            .connect(relayHub)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to execute');

        expect(recipient.isInitialized, 'Recipient method was not called').to.be
          .called;
      });

      it('Should pass the revert message from destination contract if fails', async function () {
        const { contract: recipient } = await deployContract<SmartWallet, []>({
          contractName: 'SmartWallet',
          constructorArgs: [],
        });
        const recipientFunction = recipient.interface.encodeFunctionData(
          'directExecute',
          [recipient.address, '0x00']
        );

        const deployRequest = createDeployRequest({
          relayHub: relayHub.address,
          from: owner.address,
          nonce: '0',
          tokenGas: '0',
          tokenAmount: '0',
          tokenContract: fakeToken.address,
          to: recipient.address,
          data: recipientFunction,
        });

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        await expect(
          smartWalletFactory
            .connect(relayHub)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Not the owner of the SmartWallet');
      });
    });

    it('Should pay for deployment using native', async function () {
      const amountToBePaid = hardhat.utils.parseEther('0.01');
      const deployRequest = createDeployRequest({
        relayHub: relayHub.address,
        from: owner.address,
        nonce: '0',
        tokenGas: '5000',
        tokenAmount: amountToBePaid.toString(),
        tokenContract: ZERO_ADDRESS,
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

      const smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
        owner.address,
        ZERO_ADDRESS,
        0
      );
      await owner.sendTransaction({
        to: smartWalletAddress,
        value: amountToBePaid,
      });

      const initialSwBalance = await provider.getBalance(smartWalletAddress);
      const initialOwnerBalance = await owner.getBalance();
      const initialWorkerBalance = await worker.getBalance();

      await smartWalletFactory
        .connect(relayHub)
        .relayedUserSmartWalletCreation(
          deployRequest.request,
          suffixData,
          worker.address,
          signature
        );

      const finalSwBalance = await provider.getBalance(smartWalletAddress);
      const finalOwnerBalance = await owner.getBalance();
      const finalWorkerBalance = await worker.getBalance();

      expect(finalSwBalance).to.be.equal(0);
      expect(finalOwnerBalance).to.be.equal(
        initialOwnerBalance.add(initialSwBalance).sub(amountToBePaid)
      );
      expect(finalWorkerBalance).to.be.equal(
        initialWorkerBalance.add(amountToBePaid)
      );
    });

    it('Should not pay on sponsored deployment', async function () {
      const deployRequest = createDeployRequest({
        relayHub: relayHub.address,
        from: owner.address,
        nonce: '0',
        tokenGas: '0',
        tokenAmount: '0',
        tokenContract: fakeToken.address,
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

      const ownerBalanceBefore = await provider.getBalance(owner.address);

      await smartWalletFactory
        .connect(relayHub)
        .relayedUserSmartWalletCreation(
          deployRequest.request,
          suffixData,
          worker.address,
          signature
        );

      const ownerBalanceAfter = await provider.getBalance(owner.address);

      expect(ownerBalanceBefore).to.be.equal(ownerBalanceAfter);
    });

    it('Should fail when the call method fails on native payment', async function () {
      const deployRequest = createDeployRequest({
        relayHub: relayHub.address,
        from: owner.address,
        nonce: '0',
        tokenGas: '1',
        tokenAmount: '1',
        tokenContract: ZERO_ADDRESS,
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

      await expect(
        smartWalletFactory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          )
      ).to.be.revertedWith('Unable to pay for deployment');
    });
  });
});
