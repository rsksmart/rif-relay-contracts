import {
    TestTokenInstance,
    SmartWalletInstance,
    TestForwarderTargetInstance
} from '../../types/truffle-contracts';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
    EIP712TypedData, // @ts-ignore
    signTypedData_v4,
    TypedDataUtils
} from 'eth-sig-util';
import { BN, bufferToHex, toBuffer, privateToAddress } from 'ethereumjs-util';
import TypedRequestData, {
    ForwardRequestType
} from '../../types/EIP712/TypedRequestData';
import { RelayRequest } from '../../types/EIP712/RelayRequest';
import RelayData from '../../types/EIP712/RelayData';
import { constants } from '../Constants';
import { ForwardRequest } from '../../types/EIP712/ForwardRequest';
import { bytes32, getTestingEnvironment } from '../Utils';

chai.use(chaiAsPromised);
const assert = chai.assert;

const SmartWallet = artifacts.require('SmartWallet');
const TestToken = artifacts.require('TestToken');
const TestForwarderTarget = artifacts.require('TestForwarderTarget');

/**
 * Function to get the actual token balance for an account
 * @param token
 * @param account
 * @returns The account token balance
 */
async function getTokenBalance(
    token: TestTokenInstance,
    account: string
): Promise<BN> {
    return await token.balanceOf(account);
}

/**
 * Function to add tokens to an account
 * @param token
 * @param recipient
 * @param amount
 */
async function mintTokens(
    token: TestTokenInstance,
    recipient: string,
    amount: string
): Promise<void> {
    await token.mint(amount, recipient);
}

/**
 * Function to sign a transaction
 * @param senderPrivateKey
 * @param relayRequest
 * @param chainId
 * @returns  the signature and suffix data
 */
function signRequest(
    senderPrivateKey: Buffer,
    relayRequest: RelayRequest,
    chainId: number
): { signature: string; suffixData: string } {
    const reqData: EIP712TypedData = new TypedRequestData(
        chainId,
        relayRequest.relayData.callForwarder,
        relayRequest
    );
    const signature = signTypedData_v4(senderPrivateKey, { data: reqData });
    const suffixData = bufferToHex(
        TypedDataUtils.encodeData(
            reqData.primaryType,
            reqData.message,
            reqData.types
        ).slice((1 + ForwardRequestType.length) * 32)
    );
    return { signature, suffixData };
}

/**
 *
 * @param request Function to create the basic relay request
 * @param relayData
 * @returns The relay request with basic/default values
 */
function createRequest(
    request: Partial<ForwardRequest>,
    relayData: Partial<RelayData>
): RelayRequest {
    const baseRequest: RelayRequest = {
        request: {
            relayHub: constants.ZERO_ADDRESS,
            from: constants.ZERO_ADDRESS,
            to: constants.ZERO_ADDRESS,
            value: '0',
            gas: '1000000',
            nonce: '0',
            data: '0x',
            tokenContract: constants.ZERO_ADDRESS,
            tokenAmount: '1',
            tokenGas: '50000'
        },
        relayData: {
            gasPrice: '1',
            relayWorker: constants.ZERO_ADDRESS,
            callForwarder: constants.ZERO_ADDRESS,
            callVerifier: constants.ZERO_ADDRESS
        }
    };
    return {
        request: {
            ...baseRequest.request,
            ...request
        },
        relayData: {
            ...baseRequest.relayData,
            ...relayData
        }
    };
}

contract(
    'SmartWallet contract - Unit testing on methods isInitialize and initialize',
    ([worker]) => {
        let token: TestTokenInstance;
        let senderAddress: string;
        let smartWallet: SmartWalletInstance;
        const senderPrivateKey = toBuffer(bytes32(1));

        describe('Testing initialize and isInitialize methods and values for parameters', () => {
            beforeEach(
                'Setting senderAccount, Contract instance and Test Token',
                async () => {
                    // Initializing all the variables and instances for each test
                    smartWallet = await SmartWallet.new();
                    token = await TestToken.new();
                    senderAddress = bufferToHex(
                        privateToAddress(senderPrivateKey)
                    ).toLowerCase();
                }
            );

            it('Should verify method initialize fails with a null sender address parameter', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        null,
                        token.address,
                        worker,
                        '0',
                        '400000'
                    )
                );

                assert.isFalse(await smartWallet.isInitialized());
            });

            it('Should verify method initialize fails with a ZERO owner address parameter', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        constants.ZERO_ADDRESS,
                        token.address,
                        worker,
                        '10',
                        '400000'
                    ),
                    'Unable to pay for deployment',
                    'Error while validating data'
                );

                assert.isFalse(await smartWallet.isInitialized());
            });

            it('Should verify method initialize fails with a null token address parameter', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        senderAddress,
                        null,
                        worker,
                        '0',
                        '400000'
                    )
                );

                assert.isFalse(await smartWallet.isInitialized());
            });

            it('Should verify method initialize reverts with negative gas amount', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        senderAddress,
                        token.address,
                        worker,
                        '100',
                        '-400000'
                    )
                );

                assert.isFalse(await smartWallet.isInitialized());
            });

            it('Should verify method initialize reverts with negative token amount', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        senderAddress,
                        token.address,
                        worker,
                        '-2',
                        '400000'
                    )
                );

                assert.isFalse(await smartWallet.isInitialized());
            });

            it('Should verify method initialize sucessfully with token as 0x address parameter', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isFulfilled(
                    smartWallet.initialize(
                        senderAddress,
                        constants.ZERO_ADDRESS,
                        worker,
                        '10',
                        '400000'
                    )
                );

                assert.isTrue(await smartWallet.isInitialized());
            });

            it('Should verify method initialize sucessfully with worker address as null parameter', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        senderAddress,
                        null,
                        worker,
                        '0',
                        '400000'
                    )
                );

                assert.isFalse(await smartWallet.isInitialized());
            });

            it('Should verify method initialize reverts with gas amount as null', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        senderAddress,
                        token.address,
                        worker,
                        '0',
                        null
                    )
                );

                assert.isFalse(await smartWallet.isInitialized());
            });

            it('Should verify method initialize sucessfully with all address type parameters as zero address', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isFulfilled(
                    smartWallet.initialize(
                        constants.ZERO_ADDRESS,
                        constants.ZERO_ADDRESS,
                        worker,
                        '0',
                        '400000'
                    )
                );

                assert.isTrue(await smartWallet.isInitialized());
            });

            it('Should verify method initialize successfully return with 0 tokens', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                await assert.isFulfilled(
                    smartWallet.initialize(
                        senderAddress,
                        token.address,
                        worker,
                        '0',
                        '400000'
                    )
                );

                //After initilization is complete the method should return true
                assert.isTrue(await smartWallet.isInitialized());
            });

            it('Should verify method initialize fails due to amount greater than 0 and gas less than 0', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());

                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        senderAddress,
                        token.address,
                        worker,
                        '10',
                        '-10'
                    )
                );

                //After initilization is complete the method should return true
                assert.equal(await smartWallet.isInitialized(), false);
            });

            it('Should verify method initialize fails due to amount greater than 0 and ZERO token address', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());

                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        senderAddress,
                        token.address,
                        worker,
                        '0',
                        '-400000'
                    )
                );

                assert.isFalse(await smartWallet.isInitialized());
            });

            it('Should verify method initialize fails when owner does not have funds to pay', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());

                //Initializaing the contract
                await assert.isRejected(
                    smartWallet.initialize(
                        senderAddress,
                        constants.ZERO_ADDRESS,
                        worker,
                        '10',
                        '-400000'
                    )
                );

                //After initilization is complete the method should return true
                assert.isFalse(await smartWallet.isInitialized());
            });

            it('Should verify method initialize fails when contract has already been initialized', async () => {
                //Making sure the contract has not been initialized yet
                assert.isFalse(await smartWallet.isInitialized());

                //Initializaing the contract
                await assert.isFulfilled(
                    smartWallet.initialize(
                        senderAddress,
                        token.address,
                        worker,
                        '0',
                        '400000'
                    )
                );

                //After initilization is complete the method should return true
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
            //TODO might need to include scenarios where the logic address is not 0x
        });
    }
);

contract('SmartWallet contract - Unit testing on method verify', ([worker]) => {
    describe('Testing verify method for values and parameters', () => {
        let token: TestTokenInstance;
        let senderAddress: string;
        let smartWallet: SmartWalletInstance;
        let chainId: number;
        const senderPrivateKey = toBuffer(bytes32(1));
        let recipientFunction: any;
        let recipient: TestForwarderTargetInstance;
        let relayData: Partial<RelayData>;

        beforeEach('Setting senderAccount and Test Token', async () => {
            senderAddress = bufferToHex(
                privateToAddress(senderPrivateKey)
            ).toLowerCase();
            smartWallet = await SmartWallet.new();
            token = await TestToken.new();
            recipient = await TestForwarderTarget.new();
            recipientFunction = recipient.contract.methods
                .emitMessage('hello')
                .encodeABI();
        });

        it('Should verify method verify reverts when all parameters are null', async () => {
            await assert.isRejected(smartWallet.verify(null, null, null, ''));
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
                    from: senderAddress
                },
                relayData
            );
            await assert.isRejected(
                smartWallet.verify('', '', relayRequest.request, '')
            );
        });

        it('Should verify method verify revert because owner is not the owner of the smartwallet', async () => {
            assert.isFalse(await smartWallet.isInitialized());
            //Initializaing the contract
            const senderAccount = web3.eth.accounts.create();
            await assert.isFulfilled(
                smartWallet.initialize(
                    senderAccount.address,
                    token.address,
                    worker,
                    '0',
                    '400000'
                )
            );

            assert.isTrue(await smartWallet.isInitialized());

            chainId = (await getTestingEnvironment()).chainId;

            const initialNonce = await smartWallet.nonce();

            const relayRequest = createRequest(
                {
                    data: recipientFunction,
                    to: recipient.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    tokenContract: token.address,
                    from: senderAddress
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
            assert.isFalse(await smartWallet.isInitialized());
            chainId = (await getTestingEnvironment()).chainId;

            //Initializaing the contract
            await assert.isFulfilled(
                smartWallet.initialize(
                    senderAddress,
                    token.address,
                    worker,
                    '0',
                    '400000'
                )
            );

            assert.isTrue(await smartWallet.isInitialized());
            chainId = (await getTestingEnvironment()).chainId;

            const relayRequest = createRequest(
                {
                    data: recipientFunction,
                    to: recipient.address,
                    nonce: '100',
                    relayHub: worker,
                    tokenContract: token.address,
                    from: senderAddress
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
            assert.isFalse(await smartWallet.isInitialized());

            //Initializaing the contract
            await assert.isFulfilled(
                smartWallet.initialize(
                    senderAddress,
                    token.address,
                    worker,
                    '0',
                    '400000'
                )
            );

            assert.isTrue(await smartWallet.isInitialized());
            chainId = (await getTestingEnvironment()).chainId;

            const initialNonce = await smartWallet.nonce();

            const relayRequest = await createRequest(
                {
                    data: recipientFunction,
                    to: recipient.address,
                    nonce: initialNonce.toString(),
                    relayHub: worker,
                    tokenContract: token.address,
                    from: senderAddress
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
                'Signature mismatch',
                'Error while validating data'
            );
        });

        it('Should verify method successfully sign a txn', async () => {
            assert.isFalse(await smartWallet.isInitialized());

            //Initializaing the contract
            await assert.isFulfilled(
                smartWallet.initialize(
                    senderAddress,
                    token.address,
                    worker,
                    '0',
                    '400000'
                )
            );

            assert.isTrue(await smartWallet.isInitialized());

            chainId = (await getTestingEnvironment()).chainId;

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
                    tokenGas: '400000'
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
            const senderPrivateKey = toBuffer(bytes32(1));
            let recipientFunction: any;
            let recipient: TestForwarderTargetInstance;
            let relayData: Partial<RelayData>;

            beforeEach('Setting values', async () => {
                senderAddress = bufferToHex(
                    privateToAddress(senderPrivateKey)
                ).toLowerCase();
                smartWallet = await SmartWallet.new();
                token = await TestToken.new();
                recipient = await TestForwarderTarget.new();
                chainId = (await getTestingEnvironment()).chainId;
                recipientFunction = recipient.contract.methods
                    .emitMessage('hello')
                    .encodeABI();
                relayData = {
                    callForwarder: smartWallet.address
                };
            });

            it('Should verify the method executed revert to the Invalid caller', async () => {
                assert.isFalse(await smartWallet.isInitialized());
                //Initializaing the contract
                const senderAccount = web3.eth.accounts.create();
                await assert.isFulfilled(
                    smartWallet.initialize(
                        senderAccount.address,
                        token.address,
                        worker,
                        '0',
                        '400000'
                    )
                );

                assert.isTrue(await smartWallet.isInitialized());

                chainId = (await getTestingEnvironment()).chainId;

                const initialNonce = await smartWallet.nonce();

                const relayRequest = await createRequest(
                    {
                        data: recipientFunction,
                        to: recipient.address,
                        nonce: initialNonce.toString(),
                        relayHub: senderAddress, //To make it fail
                        tokenContract: token.address,
                        from: senderAddress
                    },
                    relayData
                );

                const senderPrivateKey = toBuffer(bytes32(1));

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
                        signature,
                        { from: worker }
                    ),
                    'Invalid caller',
                    'Error while validating the data'
                );
            });

            it('Should verify the method executed revert to Unable to pay relay', async () => {
                assert.isFalse(await smartWallet.isInitialized());

                await smartWallet.initialize(
                    senderAddress,
                    token.address,
                    worker,
                    '0',
                    '400000'
                );

                assert.isTrue(await smartWallet.isInitialized());

                const initialNonce = await smartWallet.nonce();
                const relayRequest = createRequest(
                    {
                        data: recipientFunction,
                        to: recipient.address,
                        nonce: initialNonce.toString(),
                        relayHub: worker,
                        tokenContract: token.address,
                        from: senderAddress
                    },
                    relayData
                );
                relayRequest.relayData.callForwarder = smartWallet.address;
                const { signature, suffixData } = signRequest(
                    senderPrivateKey,
                    relayRequest,
                    chainId
                );

                await assert.isRejected(
                    smartWallet.execute(
                        suffixData,
                        relayRequest.request,
                        signature,
                        { from: worker }
                    ),
                    'Unable to pay for relay',
                    'Error while validating the data'
                );
            });

            it('Should verify the method executed reverts to Not enough gas', async () => {
                assert.isFalse(await smartWallet.isInitialized());

                await smartWallet.initialize(
                    senderAddress,
                    token.address,
                    worker,
                    '0',
                    '400000'
                );

                assert.isTrue(await smartWallet.isInitialized());

                const initialNonce = await smartWallet.nonce();
                const relayRequest = createRequest(
                    {
                        data: recipientFunction,
                        to: recipient.address,
                        nonce: initialNonce.toString(),
                        relayHub: worker,
                        tokenContract: token.address,
                        from: senderAddress
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
                        signature,
                        { from: worker }
                    ),
                    'Not enough gas left',
                    'Error while validating the data'
                );
            });

            it('Should verify the method executed sucess', async () => {
                assert.isFalse(await smartWallet.isInitialized());

                await smartWallet.initialize(
                    senderAddress,
                    token.address,
                    worker,
                    '0',
                    '400000'
                );

                assert.isTrue(await smartWallet.isInitialized());

                const initialNonce = await smartWallet.nonce();
                const relayRequest = createRequest(
                    {
                        data: recipientFunction,
                        to: recipient.address,
                        nonce: initialNonce.toString(),
                        relayHub: worker,
                        tokenContract: token.address,
                        from: senderAddress
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
                assert.isFalse(await smartWallet.isInitialized());

                await smartWallet.initialize(
                    senderAddress,
                    token.address,
                    worker,
                    '0',
                    '400000'
                );

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
                        tokenAmount: transferAmount.toString()
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
                assert.isFalse(await smartWallet.isInitialized());

                await smartWallet.initialize(
                    senderAddress,
                    token.address,
                    worker,
                    '0',
                    '400000'
                );

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
                        tokenAmount: transferAmount.toString()
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
            let token: TestTokenInstance;
            let senderAddress: string;
            let smartWallet: SmartWalletInstance;
            const senderPrivateKey = toBuffer(bytes32(1));
            let recipientFunction: any;
            let recipient: TestForwarderTargetInstance;

            beforeEach('Setting values', async () => {
                senderAddress = bufferToHex(
                    privateToAddress(senderPrivateKey)
                ).toLowerCase();
                smartWallet = await SmartWallet.new();
                token = await TestToken.new();
                recipient = await TestForwarderTarget.new();
                recipientFunction = recipient.contract.methods
                    .emitMessage('hello')
                    .encodeABI();
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

            it('Should call succesfully to method directExecute through node funded account', async () => {
                assert.isFalse(await smartWallet.isInitialized());

                await smartWallet.initialize(
                    fundedAccount,
                    token.address,
                    worker,
                    '0',
                    '400000'
                );

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
