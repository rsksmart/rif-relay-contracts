import { smock, FakeContract } from '@defi-wonderland/smock';
import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { bufferToHex, toBuffer, privateToAddress } from 'ethereumjs-util';
import { environments, DeployRequestType, generateBytes32, TypedRequestData, createRequest, TypedDeployRequestData, ForwardRequestType } from '../utils';
import { BaseContract, Contract } from 'ethers';
import { EnvelopingTypes } from 'typechain-types/contracts/RelayHub';
import {
    signTypedData,
    SignTypedDataVersion,
    TypedDataUtils
} from '@metamask/eth-sig-util';
import { soliditySha3Raw } from 'web3-utils';
import { UtilToken } from 'typechain-types/contracts/utils/UtilToken';

chai.use(smock.matchers);
chai.use(chaiAsPromised);
const assert = chai.assert;
const expect = chai.expect;

async function createCustomSmartWalletFactory(
    template: Contract
): Promise<Contract> {
    const customSmartWalletFactory = await ethers.getContractFactory(
        'CustomSmartWalletFactory'
    );

    return await customSmartWalletFactory.deploy(template.address);
}

async function createCustomSmartWallet(
    relayHub: string,
    ownerEOA: string,
    factory: Contract,
    privKey: Buffer,
    chainId: number,
    rReq: EnvelopingTypes.DeployRequestStruct
): Promise<Contract> {
    const { signature: deploySignature, suffixData } = signRequest(privKey, rReq, chainId);
    const txResult = await factory.relayedUserSmartWalletCreation(
        rReq.request,
        suffixData,
        deploySignature,
        { from: relayHub }
    );

    console.log(
        'Cost of deploying SmartWallet: ',
        (await txResult.wait()).cumulativeGasUsed
    );

    const swAddress = await factory.getSmartWalletAddress(
        ownerEOA,
        rReq.request.recoverer,
        rReq.request.to,
        soliditySha3Raw({ t: 'bytes', v: rReq.request.data.toString() }),
        '0'
    );

    const CustomSmartWallet = await ethers.getContractAt('CustomSmartWallet', swAddress);

    return CustomSmartWallet;
}

function signRequest(
    senderPrivateKey: Buffer,
    relayRequest: EnvelopingTypes.RelayRequestStruct | EnvelopingTypes.DeployRequestStruct,
    chainId: number
): { signature: string; suffixData: string } {
    const deployment = 'index' in relayRequest.request;

    const reqData = deployment
        ? new TypedDeployRequestData(
            chainId,
            relayRequest.relayData.callForwarder.toString(),
            relayRequest as EnvelopingTypes.DeployRequestStruct
        )
        : new TypedRequestData(
            chainId,
            relayRequest.relayData.callForwarder.toString(),
            relayRequest as EnvelopingTypes.RelayRequestStruct
        );

    const signature = signTypedData({ privateKey: senderPrivateKey, data: reqData, version: SignTypedDataVersion.V4 });
    const suffixData = bufferToHex(
        TypedDataUtils.encodeData(
            reqData.primaryType,
            reqData.message,
            reqData.types,
            SignTypedDataVersion.V4
        ).slice((1 +
            (deployment ? DeployRequestType.length : ForwardRequestType.length)) * 32)
    );

    return { signature, suffixData };
}

describe('Custom SmartWallet', function () {

    describe('Unit testing on execute method', function () {
        let customSmartWalletInstance: Contract;
        let fakeToken: FakeContract<BaseContract>;
        let relayWorker: SignerWithAddress;
        const senderPrivateKey = toBuffer(generateBytes32(1));
        let senderAddress: string;
        let fakeTestForwarderTarget: FakeContract<BaseContract>;
        let relayData: Partial<EnvelopingTypes.RelayDataStruct>;
        let recipientFunction: string;
        let chainId: number;
        let factory: Contract;
        let fakeTestToken: FakeContract<UtilToken>;;

        beforeEach(async function () {
            const customSmartWalletFactory = await ethers.getContractFactory('CustomSmartWallet');
            const smartWalletTemplate = await customSmartWalletFactory.deploy();
            factory = await createCustomSmartWalletFactory(smartWalletTemplate);

            fakeTestToken = await smock.fake('UtilToken');
            fakeToken = await smock.fake('ERC20');
            fakeTestForwarderTarget = await smock.fake('TestForwarderTarget');
            recipientFunction = fakeTestForwarderTarget.interface.encodeFunctionData('emitMessage', ['hello']);
            [relayWorker] = await ethers.getSigners();

            senderAddress = bufferToHex(
                privateToAddress(senderPrivateKey)
            ).toLowerCase();

            chainId = environments.rsk.chainId;

            const rReq = createRequest({
                relayHub: relayWorker.address,
                from: senderAddress,
                index: '0'
            }, {
                callForwarder: factory.address,
                gasPrice: '10'
            });

            customSmartWalletInstance = await createCustomSmartWallet(
                relayWorker.address,
                senderAddress,
                factory,
                senderPrivateKey,
                chainId,
                rReq
            );

        });


        it('Should verify the method executed revert to the Invalid caller', async function () {
            //Initializing the contract
            // const senderAccount = web3.eth.accounts.create();

            assert.isTrue(await customSmartWalletInstance.isInitialized());

            const initialNonce = await customSmartWalletInstance.nonce();

            const relayRequest = await createRequest(
                {
                    data: recipientFunction,
                    to: fakeTestForwarderTarget.address,
                    nonce: initialNonce.toString(),
                    relayHub: senderAddress, //To make it fail
                    tokenContract: fakeToken.address,
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
                customSmartWalletInstance.execute(
                    suffixData,
                    relayRequest.request,
                    signature,
                    { from: relayWorker.address }
                ),
                'Invalid caller',
                'Error while validating the data'
            );
        });

    });


    describe('Unit testing on method verify', function () {
        let customSmartWalletInstance: Contract;
        let fakeToken: FakeContract<BaseContract>;
        let relayWorker: SignerWithAddress;
        const senderPrivateKey = toBuffer(generateBytes32(1));
        let senderAddress: string;
        let fakeTestForwarderTarget: FakeContract<BaseContract>;
        let relayData: Partial<EnvelopingTypes.RelayDataStruct>;
        let recipientFunction: string;
        let chainId: number;
        let factory: Contract;

        beforeEach(async function () {
            const customSmartWalletFactory = await ethers.getContractFactory('CustomSmartWallet');
            const smartWalletTemplate = await customSmartWalletFactory.deploy();
            factory = await createCustomSmartWalletFactory(smartWalletTemplate);

            fakeToken = await smock.fake('ERC20');
            fakeTestForwarderTarget = await smock.fake('TestForwarderTarget');
            recipientFunction = fakeTestForwarderTarget.interface.encodeFunctionData('emitMessage', ['hello']);
            [relayWorker] = await ethers.getSigners();

            senderAddress = bufferToHex(
                privateToAddress(senderPrivateKey)
            ).toLowerCase();

            chainId = environments.rsk.chainId;
            const rReq = createRequest({
                relayHub: relayWorker.address,
                from: senderAddress,
                index: '0'
            }, {
                callForwarder: factory.address,
                gasPrice: '10'
            });

            customSmartWalletInstance = await createCustomSmartWallet(
                relayWorker.address,
                senderAddress,
                factory,
                senderPrivateKey,
                chainId,
                rReq
            );

        });


        it('Should verify method successfully sign a txn', async function () {
            assert.isTrue(await customSmartWalletInstance.isInitialized());

            const initialNonce = await customSmartWalletInstance.nonce();
            const relayRequest = createRequest(
                {
                    data: recipientFunction,
                    to: fakeTestForwarderTarget.address,
                    nonce: initialNonce.toString(),
                    relayHub: relayWorker.address,
                    tokenContract: fakeToken.address,
                    from: senderAddress,
                    value: '0',
                    gas: '400000',
                    tokenAmount: '0',
                    tokenGas: '400000'
                },
                relayData
            );

            relayRequest.relayData.callForwarder = customSmartWalletInstance.address;

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await assert.isFulfilled(
                customSmartWalletInstance.verify(
                    suffixData,
                    relayRequest.request,
                    signature
                )
            );
        });

        it('Should verify method verify reverts when all parameters are null', async function () {
            await assert.isRejected(
                customSmartWalletInstance.verify(null, null, null, '')
            );
        });

        it('Should verify method verify reverts when all parameters are empty but the request', async function () {
            const initialNonce = await customSmartWalletInstance.nonce();

            const relayRequest = await createRequest(
                {
                    data: recipientFunction,
                    to: fakeTestForwarderTarget.address,
                    nonce: initialNonce.toString(),
                    relayHub: relayWorker.address,
                    tokenContract: fakeToken.address,
                    from: senderAddress
                },
                relayData
            );
            await assert.isRejected(
                customSmartWalletInstance.verify('', relayRequest.request, '')
            );
        });

        it('Should verify method verify revert because owner is not the owner of the smart wallet', async function () {
            // assert.isFalse(await customSmartWalletInstance.isInitialized());
            //Initializing the contract
            assert.isTrue(await customSmartWalletInstance.isInitialized());

            const initialNonce = await customSmartWalletInstance.nonce();

            const relayRequest = createRequest(
                {
                    data: recipientFunction,
                    to: fakeTestForwarderTarget.address,
                    nonce: initialNonce.toString(),
                    relayHub: relayWorker.address,
                    tokenContract: fakeToken.address,
                    from: factory.address
                },
                relayData
            );

            relayRequest.relayData.callForwarder = customSmartWalletInstance.address;

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await assert.isRejected(
                customSmartWalletInstance.verify(
                    suffixData,
                    relayRequest.request,
                    signature
                ),
                'Not the owner of the SmartWallet',
                'Error while validating the owner'
            );
        });

        it('Should verify method verify revert because nonce mismatch', async function () {
            assert.isTrue(await customSmartWalletInstance.isInitialized());

            const relayRequest = createRequest(
                {
                    data: recipientFunction,
                    to: fakeTestForwarderTarget.address,
                    nonce: '100',
                    relayHub: relayWorker.address,
                    tokenContract: fakeToken.address,
                    from: senderAddress
                },
                relayData
            );

            relayRequest.relayData.callForwarder = customSmartWalletInstance.address;

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await assert.isRejected(
                customSmartWalletInstance.verify(
                    suffixData,
                    relayRequest.request,
                    signature
                ),
                'nonce mismatch',
                'Error while validating data'
            );
        });

        it('Should verify method verify and revert because of signature mismatch', async function () {
            assert.isTrue(await customSmartWalletInstance.isInitialized());

            const initialNonce = await customSmartWalletInstance.nonce();

            const relayRequest = await createRequest(
                {
                    data: recipientFunction,
                    to: fakeTestForwarderTarget.address,
                    nonce: initialNonce.toString(),
                    relayHub: relayWorker.address,
                    tokenContract: fakeToken.address,
                    from: senderAddress
                },
                relayData
            );

            const { signature, suffixData } = signRequest(
                senderPrivateKey,
                relayRequest,
                chainId
            );

            await expect(customSmartWalletInstance.verify(
                suffixData,
                relayRequest.request,
                signature
            ))
                .to.be.revertedWith('Signature mismatch');
        });

    });

    describe('Unit testing on directExecute method', function () {

        let recipientFunction: string;
        let customSmartWalletInstance: Contract;
        let customLogic: FakeContract<BaseContract>;
        let fakeTestForwarderTarget: FakeContract<BaseContract>;
        let relayWorker: SignerWithAddress;
        const senderPrivateKey = toBuffer(generateBytes32(1));
        let senderAddress: string;

        beforeEach(async function () {
            const customSmartWalletFactory = await ethers.getContractFactory('CustomSmartWallet');
            const smartWalletTemplate = await customSmartWalletFactory.deploy();
            const factory = await createCustomSmartWalletFactory(smartWalletTemplate);

            fakeTestForwarderTarget = await smock.fake('TestForwarderTarget');
            customLogic = await smock.fake('SuccessCustomLogic');
            recipientFunction = fakeTestForwarderTarget.interface.encodeFunctionData('emitMessage', ['hello']);
            [relayWorker] = await ethers.getSigners();

            const chainId = environments.rsk.chainId;

            senderAddress = bufferToHex(
                privateToAddress(senderPrivateKey)
            ).toLowerCase();

            const rReq = createRequest({
                relayHub: relayWorker.address,
                from: senderAddress,
                to: customLogic.address,
                index: '0'
            }, {
                callForwarder: factory.address,
                gasPrice: '10'
            });


            customSmartWalletInstance = await createCustomSmartWallet(
                relayWorker.address,
                senderAddress,
                factory,
                senderPrivateKey,
                chainId,
                rReq
            );

        });


        it('Should revert call to directExecute with empty parameter', async function () {
            await assert.isRejected(
                customSmartWalletInstance.directExecute('', recipientFunction, {
                    from: senderAddress
                })
            );
        });


        it('Should revert call to directExecute with null parameter', async function () {
            await assert.isRejected(
                customSmartWalletInstance.directExecute(fakeTestForwarderTarget.address, null, {
                    from: senderAddress
                })
            );
        });

        it('Should revert call to directExecute with no funded account as parameter', async function () {
            await assert.isRejected(
                customSmartWalletInstance.directExecute(
                    fakeTestForwarderTarget.address,
                    recipientFunction
                ),
                'Not the owner of the SmartWallet',
                'Error while validating the data'
            );
        });

        it('Should revert call to directExecute with INVALID_ARGUMENT as parameter', async function () {
            await assert.isRejected(
                customSmartWalletInstance.directExecute('', recipientFunction, {
                    from: senderAddress
                }),
                'INVALID_ARGUMENT',
                'Error while validating the data'
            );
        });

        //     it('Should call successfully the method directExecute through node funded account', async () => {
        //         assert.isTrue(await customSmartWalletInstance.isInitialized());
        //         const initialNonce = await customSmartWalletInstance.nonce();
        //         console.log('717');
        //         const result = await customSmartWalletInstance.directExecute(
        //             fakeTestForwarderTarget.address,
        //             recipientFunction,
        //             { from: senderAddress }
        //         );

        //         console.log('720');
        //         assert.equal(
        //             (await customSmartWalletInstance.nonce()).toString(),
        //             initialNonce.toString(),
        //             'Call to direct execute should NOT increment nonce'
        //         );

        //         console.log('727');
        //         // @ts-ignore
        //         assert(
        //             containsEvent(
        //                 customLogic.abi,
        //                 result.receipt.rawLogs,
        //                 'LogicCalled'
        //             ),
        //             'Should call custom logic'
        //         );
        //     });

    });

});