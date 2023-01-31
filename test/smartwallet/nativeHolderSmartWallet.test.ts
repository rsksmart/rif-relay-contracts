import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BN, bufferToHex, privateToAddress, toBuffer } from 'ethereumjs-util';
import { toWei } from 'web3-utils';
import {
    NativeHolderSmartWalletInstance,
    SmartWalletFactoryInstance,
    TestRecipientInstance,
    TestTokenInstance
} from '../../types/truffle-contracts';
import { constants } from '../constants';
import {
    createRequest,
    createSmartWallet,
    createSmartWalletFactory,
    generateBytes32,
    getGaslessAccount,
    getTestingEnvironment,
    signRequest
} from '../utils';

use(chaiAsPromised);

const NativeSmartWallet = artifacts.require('NativeHolderSmartWallet');
const TestToken = artifacts.require('TestToken');
const TestRecipient = artifacts.require('TestRecipient');

contract.only('NativeHolderSmartWallet', ([worker, fundedAccount]) => {
    describe('execute', () => {
        let token: TestTokenInstance;
        let senderAddress: string;
        let nativeSw: NativeHolderSmartWalletInstance;
        let factory: SmartWalletFactoryInstance;
        let chainId: number;
        const senderPrivateKey = toBuffer(generateBytes32(1));
        let recipientContract: TestRecipientInstance;

        beforeEach(async () => {
            chainId = (await getTestingEnvironment()).chainId;
            token = await TestToken.new();
            senderAddress = bufferToHex(
                privateToAddress(senderPrivateKey)
            ).toLowerCase();
            const nativeSwTemplate = await NativeSmartWallet.new();
            factory = await createSmartWalletFactory(nativeSwTemplate);
            nativeSw = await createSmartWallet(
                worker,
                senderAddress,
                factory,
                senderPrivateKey,
                chainId
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
                    tokenContract: constants.ZERO_ADDRESS,
                    from: senderAddress,
                    validUntilTime: '0',
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

        it.only('Should transfer native currency and execute transaction', async () => {
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

            const encodeData = recipientContract.contract.methods
                .emitMessage('hello')
                .encodeABI();

            const relayRequest = createRequest(
                {
                    data: encodeData,
                    to: recipientContract.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    tokenContract: constants.ZERO_ADDRESS,
                    from: senderAddress,
                    validUntilTime: '0',
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
            assert.equal(logs.length, 1, 'TestRecipient should emit');

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

        it.only('Should fail if smart wallet cannot pay native currency', async () => {
            const initialNonce = await nativeSw.nonce();

            const value = toWei('2', 'ether');

            const encodeData = recipientContract.contract.methods
                .emitMessage('hello')
                .encodeABI();

            const relayRequest = createRequest(
                {
                    data: encodeData,
                    to: recipientContract.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    tokenContract: constants.ZERO_ADDRESS,
                    from: senderAddress,
                    validUntilTime: '0',
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
            assert.equal(logs.length, 0, 'TestRecipient should not emit');
        });
    });

    /*  describe('directExecute', () => {
 
     }); */
});
