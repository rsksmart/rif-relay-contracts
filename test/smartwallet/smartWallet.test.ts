import { use, assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BN, bufferToHex, toBuffer, privateToAddress } from 'ethereumjs-util';
import { expectRevert } from '@openzeppelin/test-helpers';
import {
    TestTokenInstance,
    SmartWalletInstance,
    TestForwarderTargetInstance,
    SmartWalletFactoryInstance
} from '../../types/truffle-contracts';
import { RelayData } from '../../';
import {
    createRequest,
    createSmartWallet,
    createSmartWalletFactory,
    generateBytes32,
    getTestingEnvironment,
    getTokenBalance,
    mintTokens,
    signRequest
} from '../utils';

use(chaiAsPromised);

const SmartWallet = artifacts.require('SmartWallet');
const TestToken = artifacts.require('TestToken');
const TestForwarderTarget = artifacts.require('TestForwarderTarget');

contract(
    'SmartWallet contract - Unit testing on methods isInitialize and initialize',
    ([worker]) => {
        let token: TestTokenInstance;
        let senderAddress: string;
        let smartWallet: SmartWalletInstance;
        let factory: SmartWalletFactoryInstance;
        let chainId: number;
        const senderPrivateKey = toBuffer(generateBytes32(1));

        describe('Testing initialize and isInitialize methods and values for parameters', () => {
            beforeEach(
                'Setting senderAccount, Contract instance and Test Token',
                async () => {
                    // Initializing all the variables and instances for each test
                    chainId = (await getTestingEnvironment()).chainId;
                    token = await TestToken.new();
                    senderAddress = bufferToHex(
                        privateToAddress(senderPrivateKey)
                    ).toLowerCase();
                    const smartWalletTemplate = await SmartWallet.new();
                    factory = await createSmartWalletFactory(
                        smartWalletTemplate
                    );
                }
            );

            it('Should initialize the smart wallet properly', async () => {
                smartWallet = await createSmartWallet(
                    worker,
                    senderAddress,
                    factory,
                    senderPrivateKey,
                    chainId
                );

                assert.isTrue(await smartWallet.isInitialized());
            });

            it('Should verify method initialize fails when contract has already been initialized', async () => {
                smartWallet = await createSmartWallet(
                    worker,
                    senderAddress,
                    factory,
                    senderPrivateKey,
                    chainId
                );

                assert.isTrue(await smartWallet.isInitialized());

                await assert.isRejected(
                    smartWallet.initialize(
                        senderAddress,
                        token.address,
                        worker,
                        '0',
                        '400000'
                    ),
                    'already initialized',
                    'Error while validating data'
                );
            });
        });
    }
);

contract('SmartWallet contract - Unit testing on method verify', ([worker]) => {
    describe('Testing verify method for values and parameters', () => {
        let token: TestTokenInstance;
        let senderAddress: string;
        let smartWallet: SmartWalletInstance;
        let chainId: number;
        const senderPrivateKey = toBuffer(generateBytes32(1));
        let recipientFunction: any;
        let recipient: TestForwarderTargetInstance;
        let relayData: Partial<RelayData>;

        beforeEach('Setting senderAccount and Test Token', async () => {
            chainId = (await getTestingEnvironment()).chainId;
            senderAddress = bufferToHex(
                privateToAddress(senderPrivateKey)
            ).toLowerCase();
            const smartWalletTemplate = await SmartWallet.new();
            const factory = await createSmartWalletFactory(smartWalletTemplate);
            smartWallet = await createSmartWallet(
                worker,
                senderAddress,
                factory,
                senderPrivateKey,
                chainId
            );
            token = await TestToken.new();
            recipient = await TestForwarderTarget.new();
            recipientFunction = recipient.contract.methods
                .emitMessage('hello')
                .encodeABI();
        });

        it('Should verify method verify reverts when all parameters are null', async () => {
            await assert.isRejected(smartWallet.verify(null, null, ''));
        });

        it('Should verify method verify reverts when all parameters are empty but the request', async () => {
            const initialNonce = await smartWallet.nonce();

            const relayRequest = await createRequest(
                {
                    data: recipientFunction,
                    to: recipient.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    tokenContract: token.address,
                    from: senderAddress,
                    validUntilTime: '0'
                },
                relayData
            );
            await assert.isRejected(
                smartWallet.verify('', relayRequest.request, '')
            );
        });

        it('Should verify method verify revert because owner is not the owner of the smart wallet', async () => {
            const senderAccount = web3.eth.accounts.create();
            assert.isTrue(await smartWallet.isInitialized());

            const initialNonce = await smartWallet.nonce();

            const relayRequest = createRequest(
                {
                    data: recipientFunction,
                    to: recipient.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    tokenContract: token.address,
                    from: senderAccount.address,
                    validUntilTime: '0'
                },
                relayData
            );

            relayRequest.request.from = smartWallet.address;

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await assert.isRejected(
                smartWallet.verify(suffixData, relayRequest.request, signature),
                'Not the owner of the SmartWallet',
                'Error while validating the owner'
            );
        });

        it('Should verify method verify revert because nonce mismatch', async () => {
            assert.isTrue(await smartWallet.isInitialized());

            const relayRequest = createRequest(
                {
                    data: recipientFunction,
                    to: recipient.address,
                    nonce: '100',
                    relayHub: worker,
                    tokenContract: token.address,
                    from: senderAddress,
                    validUntilTime: '0'
                },
                relayData
            );

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await assert.isRejected(
                smartWallet.verify(suffixData, relayRequest.request, signature),
                'nonce mismatch',
                'Error while validating data'
            );
        });

        it('Should verify method verify and revert because of signature mismatch', async () => {
            assert.isTrue(await smartWallet.isInitialized());

            const initialNonce = await smartWallet.nonce();

            const relayRequest = await createRequest(
                {
                    data: recipientFunction,
                    to: recipient.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    tokenContract: token.address,
                    from: senderAddress,
                    validUntilTime: '0'
                },
                relayData
            );

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await expectRevert(
                smartWallet.verify(suffixData, relayRequest.request, signature),
                'Signature mismatch',
                'Error while validating data'
            );
        });

        it('Should verify method successfully sign a txn', async () => {
            assert.isTrue(await smartWallet.isInitialized());

            const initialNonce = await smartWallet.nonce();
            const relayRequest = createRequest(
                {
                    data: recipientFunction,
                    to: recipient.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    tokenContract: token.address,
                    from: senderAddress,
                    value: '0',
                    gas: '400000',
                    tokenAmount: '0',
                    tokenGas: '400000',
                    validUntilTime: '0'
                },
                relayData
            );
            relayRequest.relayData.callForwarder = smartWallet.address;
            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );
            await assert.isFulfilled(
                smartWallet.verify(suffixData, relayRequest.request, signature)
            );
        });
    });
});

contract(
    'SmartWallet contract - Unit testing on execute method',
    ([worker]) => {
        describe('Testing execute method for values and parameters', () => {
            let token: TestTokenInstance;
            let senderAddress: string;
            let smartWallet: SmartWalletInstance;
            let chainId: number;
            const senderPrivateKey = toBuffer(generateBytes32(1));
            let recipientFunction: any;
            let recipient: TestForwarderTargetInstance;
            let relayData: Partial<RelayData>;

            beforeEach('Setting values', async () => {
                chainId = (await getTestingEnvironment()).chainId;
                senderAddress = bufferToHex(
                    privateToAddress(senderPrivateKey)
                ).toLowerCase();
                token = await TestToken.new();
                recipient = await TestForwarderTarget.new();
                recipientFunction = recipient.contract.methods
                    .emitMessage('hello')
                    .encodeABI();
                const smartWalletTemplate = await SmartWallet.new();
                const factory = await createSmartWalletFactory(
                    smartWalletTemplate
                );
                smartWallet = await createSmartWallet(
                    worker,
                    senderAddress,
                    factory,
                    senderPrivateKey,
                    chainId
                );
                relayData = {
                    callForwarder: smartWallet.address
                };
            });

            it('Should verify the method executed revert to the Invalid caller', async () => {
                const senderAccount = web3.eth.accounts.create();
                assert.isTrue(await smartWallet.isInitialized());
                const initialNonce = await smartWallet.nonce();

                const relayRequest = await createRequest(
                    {
                        data: recipientFunction,
                        to: recipient.address,
                        nonce: initialNonce.toString(),
                        relayHub: senderAddress, //To make it fail
                        tokenContract: token.address,
                        from: senderAccount.address,
                        validUntilTime: '0'
                    },
                    relayData
                );

                recipient = await TestForwarderTarget.new();
                recipientFunction = recipient.contract.methods
                    .emitMessage('hello')
                    .encodeABI();

                const { signature, suffixData } = signRequest(
                    senderPrivateKey,
                    relayRequest,
                    chainId
                );

                await assert.isRejected(
                    smartWallet.execute(
                        suffixData,
                        relayRequest.request,
                        worker,
                        signature,
                        { from: worker }
                    ),
                    'Invalid caller',
                    'Error while validating the data'
                );
            });

            it('Should verify the method executed revert to Unable to pay relay', async () => {
                assert.isTrue(await smartWallet.isInitialized());

                const initialNonce = await smartWallet.nonce();
                const relayRequest = createRequest(
                    {
                        data: recipientFunction,
                        to: recipient.address,
                        nonce: initialNonce.toString(),
                        relayHub: worker,
                        tokenContract: token.address,
                        from: senderAddress,
                        validUntilTime: '0'
                    },
                    relayData
                );

                const { signature, suffixData } = signRequest(
                    senderPrivateKey,
                    relayRequest,
                    chainId
                );

                await assert.isRejected(
                    smartWallet.execute(
                        suffixData,
                        relayRequest.request,
                        worker,
                        signature,
                        { from: worker }
                    ),
                    'Unable to pay for relay',
                    'Error while validating the data'
                );
            });

            it('Should verify the method executed reverts to Not enough gas', async () => {
                assert.isTrue(await smartWallet.isInitialized());

                const initialNonce = await smartWallet.nonce();
                const relayRequest = createRequest(
                    {
                        data: recipientFunction,
                        to: recipient.address,
                        nonce: initialNonce.toString(),
                        relayHub: worker,
                        tokenContract: token.address,
                        from: senderAddress,
                        validUntilTime: '0'
                    },
                    relayData
                );
                relayRequest.request.gas = '1000000000000000';
                const { signature, suffixData } = signRequest(
                    senderPrivateKey,
                    relayRequest,
                    chainId
                );
                await mintTokens(token, smartWallet.address, '1000');

                await assert.isRejected(
                    smartWallet.execute(
                        suffixData,
                        relayRequest.request,
                        worker,
                        signature,
                        { from: worker }
                    ),
                    'Not enough gas left',
                    'Error while validating the data'
                );
            });

            it('Should verify the method executed success', async () => {
                assert.isTrue(await smartWallet.isInitialized());

                const initialNonce = await smartWallet.nonce();
                const relayRequest = createRequest(
                    {
                        data: recipientFunction,
                        to: recipient.address,
                        nonce: initialNonce.toString(),
                        relayHub: worker,
                        tokenContract: token.address,
                        from: senderAddress,
                        validUntilTime: '0'
                    },
                    relayData
                );
                relayRequest.request.gas = '100';
                const { signature, suffixData } = signRequest(
                    senderPrivateKey,
                    relayRequest,
                    chainId
                );
                await mintTokens(token, smartWallet.address, '1000');

                await assert.isFulfilled(
                    smartWallet.execute(
                        suffixData,
                        relayRequest.request,
                        worker,
                        signature,
                        { from: worker }
                    )
                );
                assert.equal(
                    (await smartWallet.nonce()).toString(),
                    initialNonce.add(new BN(1)).toString(),
                    'Calling execute method should increment nonce'
                );
            });

            it('Should verify the method executed success to same sender and receiver', async () => {
                const transferAmount = 1000;
                assert.isTrue(await smartWallet.isInitialized());
                const initialNonce = await smartWallet.nonce();
                const initialBalance = getTokenBalance(token, senderAddress);
                const relayRequest = createRequest(
                    {
                        data: recipientFunction,
                        to: senderAddress,
                        nonce: initialNonce.toString(),
                        relayHub: worker,
                        tokenContract: token.address,
                        from: senderAddress,
                        tokenAmount: transferAmount.toString(),
                        validUntilTime: '0'
                    },
                    relayData
                );
                relayRequest.request.gas = '100';
                const { signature, suffixData } = signRequest(
                    senderPrivateKey,
                    relayRequest,
                    chainId
                );
                await mintTokens(
                    token,
                    smartWallet.address,
                    transferAmount.toString()
                );

                await assert.isFulfilled(
                    smartWallet.execute(
                        suffixData,
                        relayRequest.request,
                        worker,
                        signature,
                        { from: worker }
                    )
                );
                assert.equal(
                    (await smartWallet.nonce()).toString(),
                    initialNonce.add(new BN(1)).toString(),
                    'Calling execute method should increment nonce'
                );
                assert.equal(
                    initialBalance.toString(),
                    getTokenBalance(token, senderAddress).toString(),
                    'Sender balance do not match'
                );
            });

            it('Should verify balances after a transaction between accounts', async () => {
                const transferAmount = 1000;
                assert.isTrue(await smartWallet.isInitialized());
                const initialNonce = await smartWallet.nonce();
                const initialWorkerTokenBalance = await getTokenBalance(
                    token,
                    worker
                );
                const initialSWalletTokenBalance = await getTokenBalance(
                    token,
                    smartWallet.address
                );
                const relayRequest = createRequest(
                    {
                        data: recipientFunction,
                        to: recipient.address,
                        nonce: initialNonce.toString(),
                        relayHub: worker,
                        tokenContract: token.address,
                        from: senderAddress,
                        tokenAmount: transferAmount.toString(),
                        validUntilTime: '0'
                    },
                    relayData
                );
                relayRequest.request.gas = '100';

                const { signature, suffixData } = signRequest(
                    senderPrivateKey,
                    relayRequest,
                    chainId
                );
                await mintTokens(
                    token,
                    smartWallet.address,
                    transferAmount.toString()
                );

                assert.equal(
                    (
                        await getTokenBalance(token, smartWallet.address)
                    ).toString(),
                    new BN(transferAmount).toString(),
                    'Smart wallet token balance was not increased'
                );

                await assert.isFulfilled(
                    smartWallet.execute(
                        suffixData,
                        relayRequest.request,
                        worker,
                        signature,
                        { from: worker }
                    )
                );

                const tknBalance = await getTokenBalance(token, worker);
                const swTknBalance = await getTokenBalance(
                    token,
                    smartWallet.address
                );

                assert.equal(
                    tknBalance.toString(),
                    initialWorkerTokenBalance
                        .add(new BN(transferAmount))
                        .toString(),
                    'Worker token balance did not change'
                );
                assert.equal(
                    swTknBalance.toString(),
                    initialSWalletTokenBalance.toString(),
                    'Smart wallet token balance did not change'
                );
                assert.equal(
                    (await smartWallet.nonce()).toString(),
                    initialNonce.add(new BN(1)).toString(),
                    'Call to execute should increment nonce'
                );
            });
        });
    }
);

contract(
    'SmartWallet contract - Unit testing on directExecute method',
    ([worker, fundedAccount]) => {
        describe('Testing directExecute method for values and parameters', () => {
            let smartWallet: SmartWalletInstance;
            let recipientFunction: any;
            let recipient: TestForwarderTargetInstance;
            const fundedAccountPrivateKey: Buffer = Buffer.from(
                '0c06818f82e04c564290b32ab86b25676731fc34e9a546108bf109194c8e3aae',
                'hex'
            );

            beforeEach('Setting values', async () => {
                const chainId = (await getTestingEnvironment()).chainId;
                recipient = await TestForwarderTarget.new();
                recipientFunction = recipient.contract.methods
                    .emitMessage('hello')
                    .encodeABI();
                const smartWalletTemplate = await SmartWallet.new();
                const factory = await createSmartWalletFactory(
                    smartWalletTemplate
                );
                smartWallet = await createSmartWallet(
                    worker,
                    fundedAccount,
                    factory,
                    fundedAccountPrivateKey,
                    chainId
                );
            });

            it('Should revert call to directExecute with empty parameter', async () => {
                await assert.isRejected(
                    smartWallet.directExecute('', recipientFunction, {
                        from: fundedAccount
                    })
                );
            });

            it('Should revert call to directExecute with null parameter', async () => {
                await assert.isRejected(
                    smartWallet.directExecute(recipient.address, null, {
                        from: fundedAccount
                    })
                );
            });

            it('Should revert call to directExecute with no funded account as parameter', async () => {
                await assert.isRejected(
                    smartWallet.directExecute(
                        recipient.address,
                        recipientFunction
                    ),
                    'Not the owner of the SmartWallet',
                    'Error while validating the data'
                );
            });

            it('Should revert call to directExecute with INVALID_ARGUMENT as parameter', async () => {
                await assert.isRejected(
                    smartWallet.directExecute('', recipientFunction, {
                        from: fundedAccount
                    }),
                    'INVALID_ARGUMENT',
                    'Error while validating the data'
                );
            });

            it('Should call successfully the method directExecute through node funded account', async () => {
                assert.isTrue(await smartWallet.isInitialized());
                const initialNonce = await smartWallet.nonce();

                await assert.isFulfilled(
                    smartWallet.directExecute(
                        recipient.address,
                        recipientFunction,
                        { from: fundedAccount }
                    )
                );
                assert.equal(
                    (await smartWallet.nonce()).toString(),
                    initialNonce.toString(),
                    'Call to direct execute should NOT increment nonce'
                );
            });
        });
    }
);

/* TODO - ADD tests for recover method */
