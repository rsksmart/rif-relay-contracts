import {
    RelayVerifierInstance,
    TestTokenInstance,
    SmartWalletFactoryInstance,
    SmartWalletInstance
} from '../../types/truffle-contracts';
import { RelayRequest } from '../../';
import { constants } from '../Constants';
import { toBuffer, bufferToHex, privateToAddress } from 'ethereumjs-util';
import {
    bytes32,
    createSmartWalletFactory,
    createSmartWallet,
    getTestingEnvironment
} from '../utils/TestUtils';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const assert = chai.assert;

//Constants and general values
const TestToken = artifacts.require('TestToken');
const SmartWallet = artifacts.require('SmartWallet');
const RelayVerifier = artifacts.require('RelayVerifier');
const TestRecipient = artifacts.require('TestRecipient');

const gasPrice = '10';
const senderNonce = '0';
const tokensPaid = 1;

contract('Testing Tokens - RelayVerifier contract', () => {
    let token: TestTokenInstance;
    let smartWallet: SmartWalletInstance;
    let factory: SmartWalletFactoryInstance;
    let contractVerifier: RelayVerifierInstance;
    describe('Testing tokens acceptance', () => {
        beforeEach('', async () => {
            token = await TestToken.new();
            smartWallet = await SmartWallet.new();
            factory = await createSmartWalletFactory(smartWallet);
            contractVerifier = await RelayVerifier.new(factory.address);
        });
        it('Should verify the contract accepts test tokens', async () => {
            await contractVerifier.acceptToken(token.address);
            assert.isTrue(
                await contractVerifier.acceptsToken(token.address),
                'Contract does not accepts token'
            );
        });

        it('Should verify the contract accepts more than one test tokens and verify tokens added are listed', async () => {
            //Creating tokens
            const tokens = [token];
            tokens.push(await TestToken.new());
            tokens.push(await TestToken.new());

            //Adding tokens to contract list
            for (const tkn of tokens) {
                const rspToken = await contractVerifier.acceptToken(
                    tkn.address
                );
                assert.isEmpty(
                    rspToken.logs,
                    'Log found for txn, token not accepted'
                );
            }

            //Verifying contract tokens list
            const accepted_Tokens = await contractVerifier.getAcceptedTokens();
            assert.isTrue(
                tokens.some((tkn) =>
                    accepted_Tokens.includes(tkn.address.toString())
                )
            );
        });

        it('Should verify the contract does not accept a duplicated test token', async () => {
            //Adding first token
            const rspToken = await contractVerifier.acceptToken(token.address);
            assert.isEmpty(
                rspToken.logs,
                'Log found for txn, token not accepted'
            );

            //Adding second token
            const token2 = await TestToken.new();
            const rspToken2 = await contractVerifier.acceptToken(
                token2.address
            );
            assert.isEmpty(
                rspToken2.logs,
                'Log found for txn, token not accepted'
            );

            await assert.isRejected(
                contractVerifier.acceptToken(token.address),
                'Token is already accepted',
                'A duplicated token was accepted'
            );
        });

        it('Should verify the contract does not accepts an invalid test token address', async () => {
            const invalid_address = web3.eth.accounts.create();
            await assert.isRejected(
                contractVerifier.acceptToken(
                    invalid_address.address.toUpperCase()
                ),
                'invalid address',
                'Contract does not accept this token: ' + invalid_address
            );
        });

        it('Should verify the contract version', async () => {
            const version = await contractVerifier.versionVerifier();
            assert.isString(version, 'Version not properly retrieved');
        });
    });
});

contract(
    'Testing verifyRelayedCall - RelayVerifier contract',
    ([relayHub, relayWorker]) => {
        let relayRequestData: RelayRequest;
        let token: TestTokenInstance;
        let smartWallet: SmartWalletInstance;
        let sw: SmartWalletInstance;
        let factory: SmartWalletFactoryInstance;
        let contractVerifier: RelayVerifierInstance;
        let expectedAddress: string;

        const senderPrivateKey = toBuffer(bytes32(1));
        let senderAddress: string;

        describe('Testing call to verifyRelayedCall method', () => {
            const ownerPrivateKey = toBuffer(bytes32(1));
            let ownerAddress: string;

            const recoverer = constants.ZERO_ADDRESS;
            const index = '0';
            const gasLimit = '1000000';

            beforeEach(
                'Creating instances to be used by every test',
                async () => {
                    ownerAddress = bufferToHex(
                        privateToAddress(ownerPrivateKey)
                    ).toLowerCase();
                    senderAddress = bufferToHex(
                        privateToAddress(senderPrivateKey)
                    ).toLowerCase();

                    const env = await getTestingEnvironment();
                    const chainId = env.chainId;

                    token = await TestToken.new();
                    smartWallet = await SmartWallet.new();
                    factory = await createSmartWalletFactory(smartWallet);

                    contractVerifier = await RelayVerifier.new(factory.address);
                    sw = await createSmartWallet(
                        relayHub,
                        senderAddress,
                        factory,
                        senderPrivateKey,
                        chainId
                    );
                    const recipientContract = await TestRecipient.new();

                    relayRequestData = {
                        request: {
                            relayHub: relayHub,
                            to: recipientContract.address,
                            data: '0x00',
                            from: senderAddress,
                            nonce: senderNonce,
                            value: '0',
                            gas: gasLimit,
                            tokenContract: token.address,
                            tokenAmount: tokensPaid.toString(),
                            tokenGas: '50000'
                        },
                        relayData: {
                            gasPrice,
                            relayWorker,
                            callForwarder: sw.address,
                            callVerifier: contractVerifier.address
                        }
                    };

                    // Minting tokens to the smart wallet
                    expectedAddress = await factory.getSmartWalletAddress(
                        ownerAddress,
                        recoverer,
                        index
                    );
                    await token.mint(tokensPaid + 5, expectedAddress);
                }
            );

            it('Should fail on Token contract not allowed of preRelayCall', async () => {
                await assert.isRejected(
                    contractVerifier.verifyRelayedCall(
                        relayRequestData,
                        '0x00',
                        { from: relayHub }
                    ),
                    'Token contract not allowed'
                );
            });

            it('Should fail on Balance too low of preRelayCall', async () => {
                //Changing the initial params so the smart wallet address will be different to force NO balance
                relayRequestData.request.data = '0x01';
                relayRequestData.request.tokenAmount = (
                    tokensPaid + 100
                ).toString();

                await contractVerifier.acceptToken(token.address);

                await assert.isRejected(
                    contractVerifier.verifyRelayedCall(
                        relayRequestData,
                        '0x00',
                        { from: relayHub }
                    ),
                    'balance too low',
                    'Failed assert'
                );
            });

            it('Should not fail on checks of preRelayCall', async () => {
                await contractVerifier.acceptToken(token.address);

                const rspSuccess = await contractVerifier.verifyRelayedCall(
                    relayRequestData,
                    '0x',
                    { from: relayHub }
                );
                assert.isEmpty(rspSuccess.logs, 'Call was NOT successful');
            });
        });
    }
);
