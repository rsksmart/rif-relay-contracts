import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { BaseProvider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, ethers, Wallet } from 'ethers';
import { ethers as hardhat } from 'hardhat';
import {
  ERC20,
  NativeHolderSmartWallet,
  NativeHolderSmartWallet__factory,
} from '../../typechain-types';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe.only('SmartWallet contract', function () {
  describe('Function directExecuteWithValue() mocked', function () {
    let mockSmartWallet: MockContract<NativeHolderSmartWallet>;
    let provider: BaseProvider;
    let owner: Wallet;
    let fakeToken: FakeContract<ERC20>;
    let fundedAccount: SignerWithAddress;

    beforeEach(async function () {
      [, fundedAccount] = (await hardhat.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress,
        SignerWithAddress
      ];

      const mockSmartWalletFactory =
        await smock.mock<NativeHolderSmartWallet__factory>(
          'NativeHolderSmartWallet'
        );

      provider = hardhat.provider;
      owner = hardhat.Wallet.createRandom().connect(provider);

      //Fund the owner
      await fundedAccount.sendTransaction({
        to: owner.address,
        value: hardhat.utils.parseEther('1'),
      });
      mockSmartWallet = await mockSmartWalletFactory.connect(owner).deploy();

      fakeToken = await smock.fake('ERC20');
      fakeToken.transfer.returns(true);
    });

    it('Should transfer native currency without executing a transaction', async function () {
      const recipient = Wallet.createRandom();
      await fundedAccount.sendTransaction({
        to: mockSmartWallet.address,
        value: hardhat.utils.parseEther('5'),
      });

      const recipientBalancePriorExecution = await provider.getBalance(
        recipient.address
      );
      const swBalancePriorExecution = await provider.getBalance(
        mockSmartWallet.address
      );

      const value = ethers.utils.parseEther('2');

      await expect(
        mockSmartWallet.directExecuteWithValue(
          recipient.address,
          value,
          '0x00'
        ),
        'Execution failed'
      ).not.to.be.rejected;

      const recipientBalanceAfterExecution = await provider.getBalance(
        recipient.address
      );
      const swBalanceAfterExecution = await provider.getBalance(
        mockSmartWallet.address
      );

      const valueBN = BigNumber.from(value);

      const expectedRecipientBalance = BigNumber.from(
        recipientBalancePriorExecution
      ).add(valueBN);
      const expectedSwBalance = BigNumber.from(swBalancePriorExecution).sub(
        valueBN
      );

      expect(expectedRecipientBalance.toString()).to.be.equal(
        recipientBalanceAfterExecution.toString()
      );
      expect(expectedSwBalance.toString()).to.be.equal(
        swBalanceAfterExecution.toString()
      );
    });
  });
});

/* import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BN } from 'ethereumjs-util';
import { toWei } from 'web3-utils';
import {
    NativeHolderSmartWalletInstance,
    SmartWalletFactoryInstance,
    TestRecipientInstance
} from '../../types/truffle-contracts';
import {
    createRequest,
    createSmartWallet,
    createSmartWalletFactory,
    getGaslessAccount,
    getTestingEnvironment,
    signRequest
} from '../utils';

use(chaiAsPromised);

const NativeSmartWallet = artifacts.require('NativeHolderSmartWallet');
const TestRecipient = artifacts.require('TestRecipient');

contract('NativeHolderSmartWallet', ([worker, sender, fundedAccount]) => {
    const senderPrivateKey: Buffer = Buffer.from(
        '0c06818f82e04c564290b32ab86b25676731fc34e9a546108bf109194c8e3aae',
        'hex'
    );
    describe('execute', () => {
        let nativeSw: NativeHolderSmartWalletInstance;
        let factory: SmartWalletFactoryInstance;
        let chainId: number;
        let recipientContract: TestRecipientInstance;

        beforeEach(async () => {
            chainId = (await getTestingEnvironment()).chainId;
            const nativeSwTemplate = await NativeSmartWallet.new();
            factory = await createSmartWalletFactory(nativeSwTemplate);
            nativeSw = await createSmartWallet<NativeHolderSmartWalletInstance>(
                {
                    relayHub: worker,
                    ownerEOA: sender,
                    factory,
                    privKey: senderPrivateKey,
                    chainId,
                    smartWalletContractName: 'NativeHolderSmartWallet'
                }
            );
            recipientContract = await TestRecipient.new();
        });

        it('Should transfer native currency without executing a transaction', async () => {
            const initialNonce = await nativeSw.nonce();

            await web3.eth.sendTransaction({
                from: fundedAccount,
                to: nativeSw.address,
                value: toWei('5', 'ether')
            });

            const recipient = await getGaslessAccount();

            const recipientBalancePriorExecution = await web3.eth.getBalance(
                recipient.address
            );
            const swBalancePriorExecution = await web3.eth.getBalance(
                nativeSw.address
            );

            const value = toWei('2', 'ether');

            const relayRequest = createRequest(
                {
                    data: '0x00',
                    to: recipient.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    from: sender,
                    value
                },
                {
                    callForwarder: nativeSw.address
                }
            );

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await nativeSw.execute(
                suffixData,
                relayRequest.request,
                worker,
                signature,
                { from: worker }
            );

            const recipientBalanceAfterExecution = await web3.eth.getBalance(
                recipient.address
            );
            const swBalanceAfterExecution = await web3.eth.getBalance(
                nativeSw.address
            );

            const valueBN = new BN(value);

            const expectedRecipientBalance = new BN(
                recipientBalancePriorExecution
            ).add(valueBN);
            const expectedSwBalance = new BN(swBalancePriorExecution).sub(
                valueBN
            );

            expect(expectedRecipientBalance.toString()).to.be.equal(
                recipientBalanceAfterExecution.toString()
            );
            expect(expectedSwBalance.toString()).to.be.equal(
                swBalanceAfterExecution.toString()
            );
        });

        it('Should transfer native currency and execute transaction', async () => {
            const initialNonce = await nativeSw.nonce();

            await web3.eth.sendTransaction({
                from: fundedAccount,
                to: nativeSw.address,
                value: toWei('5', 'ether')
            });

            const recipientBalancePriorExecution = await web3.eth.getBalance(
                recipientContract.address
            );
            const swBalancePriorExecution = await web3.eth.getBalance(
                nativeSw.address
            );

            const value = toWei('2', 'ether');

            const encodedData = recipientContract.contract.methods
                .emitMessage('hello')
                .encodeABI();

            const relayRequest = createRequest(
                {
                    data: encodedData,
                    to: recipientContract.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    from: sender,
                    value
                },
                {
                    callForwarder: nativeSw.address
                }
            );

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await nativeSw.execute(
                suffixData,
                relayRequest.request,
                worker,
                signature,
                { from: worker }
            );

            // @ts-ignore
            const logs = await recipientContract.getPastEvents(
                'SampleRecipientEmitted'
            );
            expect(logs.length).to.be.equal(1, 'TestRecipient should emit');

            const recipientBalanceAfterExecution = await web3.eth.getBalance(
                recipientContract.address
            );
            const swBalanceAfterExecution = await web3.eth.getBalance(
                nativeSw.address
            );

            const valueBN = new BN(value);

            const expectedRecipientBalance = new BN(
                recipientBalancePriorExecution
            ).add(valueBN);
            const expectedSwBalance = new BN(swBalancePriorExecution).sub(
                valueBN
            );

            expect(expectedRecipientBalance.toString()).to.be.equal(
                recipientBalanceAfterExecution.toString()
            );
            expect(expectedSwBalance.toString()).to.be.equal(
                swBalanceAfterExecution.toString()
            );
        });

        it('Should fail if smart wallet cannot pay native currency', async () => {
            const initialNonce = await nativeSw.nonce();

            const value = toWei('2', 'ether');

            const encodedData = recipientContract.contract.methods
                .emitMessage('hello')
                .encodeABI();

            const relayRequest = createRequest(
                {
                    data: encodedData,
                    to: recipientContract.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    from: sender,
                    value
                },
                {
                    callForwarder: nativeSw.address
                }
            );

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await nativeSw.execute(
                suffixData,
                relayRequest.request,
                worker,
                signature,
                { from: worker }
            );

            // @ts-ignore
            const logs = await recipientContract.getPastEvents(
                'SampleRecipientEmitted'
            );
            expect(logs.length).to.be.equal(0, 'TestRecipient should not emit');
        });
    });

    describe('directExecuteWithValue', () => {
        let nativeSw: NativeHolderSmartWalletInstance;
        let factory: SmartWalletFactoryInstance;
        let chainId: number;

        let recipientContract: TestRecipientInstance;

        beforeEach(async () => {
            chainId = (await getTestingEnvironment()).chainId;
            const nativeSwTemplate = await NativeSmartWallet.new();
            factory = await createSmartWalletFactory(nativeSwTemplate);
            nativeSw = await createSmartWallet<NativeHolderSmartWalletInstance>(
                {
                    relayHub: worker,
                    ownerEOA: sender,
                    factory,
                    privKey: senderPrivateKey,
                    chainId,
                    smartWalletContractName: 'NativeHolderSmartWallet'
                }
            );
            recipientContract = await TestRecipient.new();
        });

        it('Should transfer native currency without executing a transaction', async () => {
            await web3.eth.sendTransaction({
                from: fundedAccount,
                to: nativeSw.address,
                value: toWei('5', 'ether')
            });

            const recipient = await getGaslessAccount();

            const recipientBalancePriorExecution = await web3.eth.getBalance(
                recipient.address
            );
            const swBalancePriorExecution = await web3.eth.getBalance(
                nativeSw.address
            );

            const value = toWei('2', 'ether');

            await nativeSw.directExecuteWithValue(
                recipient.address,
                value,
                '0x00',
                { from: sender }
            );

            const recipientBalanceAfterExecution = await web3.eth.getBalance(
                recipient.address
            );
            const swBalanceAfterExecution = await web3.eth.getBalance(
                nativeSw.address
            );

            const valueBN = new BN(value);

            const expectedRecipientBalance = new BN(
                recipientBalancePriorExecution
            ).add(valueBN);
            const expectedSwBalance = new BN(swBalancePriorExecution).sub(
                valueBN
            );

            expect(expectedRecipientBalance.toString()).to.be.equal(
                recipientBalanceAfterExecution.toString()
            );
            expect(expectedSwBalance.toString()).to.be.equal(
                swBalanceAfterExecution.toString()
            );
        });

        it('Should transfer native currency and execute transaction', async () => {
            await web3.eth.sendTransaction({
                from: fundedAccount,
                to: nativeSw.address,
                value: toWei('5', 'ether')
            });

            const recipientBalancePriorExecution = await web3.eth.getBalance(
                recipientContract.address
            );
            const swBalancePriorExecution = await web3.eth.getBalance(
                nativeSw.address
            );

            const value = toWei('2', 'ether');

            const encodedData = recipientContract.contract.methods
                .emitMessage('hello')
                .encodeABI();

            await nativeSw.directExecuteWithValue(
                recipientContract.address,
                value,
                encodedData,
                { from: sender }
            );

            // @ts-ignore
            const logs = await recipientContract.getPastEvents(
                'SampleRecipientEmitted'
            );
            expect(logs.length).to.be.equal(1, 'TestRecipient should emit');

            const recipientBalanceAfterExecution = await web3.eth.getBalance(
                recipientContract.address
            );
            const swBalanceAfterExecution = await web3.eth.getBalance(
                nativeSw.address
            );

            const valueBN = new BN(value);

            const expectedRecipientBalance = new BN(
                recipientBalancePriorExecution
            ).add(valueBN);
            const expectedSwBalance = new BN(swBalancePriorExecution).sub(
                valueBN
            );

            expect(expectedRecipientBalance.toString()).to.be.equal(
                recipientBalanceAfterExecution.toString()
            );
            expect(expectedSwBalance.toString()).to.be.equal(
                swBalanceAfterExecution.toString()
            );
        });

        it('Should fail if smart wallet cannot pay native currency', async () => {
            const value = toWei('2', 'ether');

            const encodedData = recipientContract.contract.methods
                .emitMessage('hello')
                .encodeABI();

            await nativeSw.directExecuteWithValue(
                recipientContract.address,
                value,
                encodedData,
                { from: sender }
            );

            // @ts-ignore
            const logs = await recipientContract.getPastEvents(
                'SampleRecipientEmitted'
            );
            expect(logs.length).to.be.equal(0, 'TestRecipient should not emit');
        });
    });
});
 */
