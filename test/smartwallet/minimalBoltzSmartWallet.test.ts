import { FakeContract, smock } from '@defi-wonderland/smock';
import { BaseProvider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Wallet, constants, ethers } from 'ethers';
import { ethers as hardhat } from 'hardhat';
import { ERC20, MinimalBoltzSmartWalletFactory } from 'typechain-types';
import {
  getLocalEip712DeploySignature,
  TypedDeployRequestData,
} from '../utils/EIP712Utils';
import { createDeployRequest, getSuffixData, HARDHAT_CHAIN_ID } from './utils';
import { Interface } from 'ethers/lib/utils';

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

  describe('Function initialize()', function () {
    let worker: Wallet;
    let recipient: FakeContract;
    let recipientFunction: string;
    let abiInterface: Interface;

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

      const ABI = [
        'function claim(bytes32 preimage, uint amount, address claimAddress, address refundAddress, uint timelock)',
        'function claim(bytes32 preimage, uint amount, address refundAddress, uint timelock)',
      ];
      recipient = await smock.fake(ABI);

      abiInterface = new hardhat.utils.Interface(ABI);
      recipientFunction = abiInterface.encodeFunctionData(
        'claim(bytes32,uint256,address,uint256)',
        [
          constants.HashZero,
          ethers.utils.parseEther('0.5'),
          constants.AddressZero,
          500,
        ]
      );
    });

    it('Should pay for deployment using native(external)', async function () {
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
      expect(
        recipient['claim(bytes32,uint256,address,uint256)'],
        'Recipient method was not called'
      ).to.be.called;
    });

    it('Should pay for deployment using native(public)', async function () {
      recipientFunction = abiInterface.encodeFunctionData(
        'claim(bytes32,uint256,address,address,uint256)',
        [
          constants.HashZero,
          ethers.utils.parseEther('0.5'),
          constants.AddressZero,
          constants.AddressZero,
          500,
        ]
      );
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
      expect(
        recipient['claim(bytes32,uint256,address,address,uint256)'],
        'Recipient method was not called'
      ).to.be.called;
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

      const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
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
      expect(
        recipient['claim(bytes32,uint256,address,uint256)'],
        'Recipient method was not called'
      ).to.be.called;
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

      const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
      const signature = getLocalEip712DeploySignature(
        typedDeployData,
        privateKey
      );

      recipient['claim(bytes32,uint256,address,uint256)'].reverts();

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

      expect(
        recipient['claim(bytes32,uint256,address,uint256)'],
        'Recipient method was not called'
      ).to.be.called;
    });

    it('Should fail if signature is not allowed', async function () {
      const deployRequest = createDeployRequest({
        relayHub: relayHub.address,
        from: owner.address,
        nonce: '0',
        tokenGas: '0',
        tokenAmount: '0',
        tokenContract: fakeToken.address,
        to: recipient.address,
        data: '0x00',
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
      ).to.be.rejectedWith('Method not allowed');
    });
  });
});
