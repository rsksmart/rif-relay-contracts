// import {
//     TestTokenInstance,
//     CustomSmartWalletInstance,
//     SuccessCustomLogicInstance,
//     TestForwarderTargetInstance,
//     CustomSmartWalletFactoryInstance
// } from '../../types/truffle-contracts';
// import { use, assert } from 'chai';
// import chaiAsPromised from 'chai-as-promised';
// import { BN, bufferToHex, toBuffer, privateToAddress } from 'ethereumjs-util';
// import { expectRevert } from '@openzeppelin/test-helpers';
// import { RelayData } from '../../';
// import {
//     generateBytes32,
//     getTestingEnvironment,
//     containsEvent,
//     createCustomSmartWallet,
//     createCustomSmartWalletFactory,
//     createRequest,
//     signRequest,
//     mintTokens,
//     getTokenBalance
// } from '../utils';

// use(chaiAsPromised);

// const CustomSmartWallet = artifacts.require('CustomSmartWallet');
// const SuccessCustomLogic = artifacts.require('SuccessCustomLogic');
// const TestToken = artifacts.require('TestToken');
// const TestForwarderTarget = artifacts.require('TestForwarderTarget');

// contract(
//     'Custom SmartWallet contract - Unit testing on methods isInitialize and initialize',
//     ([worker]) => {
//         let token: TestTokenInstance;
//         let senderAddress: string;
//         let customLogic: SuccessCustomLogicInstance;
//         let smartWallet: CustomSmartWalletInstance;
//         let factory: CustomSmartWalletFactoryInstance;
//         let chainId: number;
//         const senderPrivateKey = toBuffer(generateBytes32(1));

//         describe('Testing initialize and isInitialize methods and values for parameters', () => {
//             beforeEach(
//                 'Setting senderAccount, Contract instance and Test Token',
//                 async () => {
//                     // Initializing all the variables and instances for each test
//                     chainId = (await getTestingEnvironment()).chainId;
//                     customLogic = await SuccessCustomLogic.new();
//                     token = await TestToken.new();
//                     senderAddress = bufferToHex(
//                         privateToAddress(senderPrivateKey)
//                     ).toLowerCase();
//                     const smartWalletTemplate = await CustomSmartWallet.new();
//                     factory = await createCustomSmartWalletFactory(
//                         smartWalletTemplate
//                     );
//                 }
//             );

//             it('Should initialize the smart wallet properly', async () => {
//                 smartWallet = await createCustomSmartWallet(
//                     worker,
//                     senderAddress,
//                     factory,
//                     senderPrivateKey,
//                     chainId
//                 );

//                 assert.isTrue(await smartWallet.isInitialized());
//             });

//             it('Should verify method initialize fails when contract has already been initialized', async () => {
//                 smartWallet = await createCustomSmartWallet(
//                     worker,
//                     senderAddress,
//                     factory,
//                     senderPrivateKey,
//                     chainId
//                 );

//                 assert.isTrue(await smartWallet.isInitialized());

//                 await assert.isRejected(
//                     smartWallet.initialize(
//                         senderAddress,
//                         customLogic.address,
//                         token.address,
//                         worker,
//                         '0',
//                         '400000',
//                         '0x'
//                     ),
//                     'already initialized',
//                     'Error while validating data'
//                 );
//             });
//             //TODO might need to include scenarios where the logic address is not 0x
//         });
//     }
// );

// contract(
//     'Custom SmartWallet contract - Unit testing on method verify',
//     ([worker]) => {
//         describe('Testing verify method for values and parameters', () => {
//             let token: TestTokenInstance;
//             let senderAddress: string;
//             let smartWallet: CustomSmartWalletInstance;
//             let chainId: number;
//             const senderPrivateKey = toBuffer(generateBytes32(1));
//             let recipientFunction: any;
//             let recipient: TestForwarderTargetInstance;
//             let relayData: Partial<RelayData>;

//             beforeEach('Setting senderAccount and Test Token', async () => {
//                 chainId = (await getTestingEnvironment()).chainId;
//                 senderAddress = bufferToHex(
//                     privateToAddress(senderPrivateKey)
//                 ).toLowerCase();
//                 const smartWalletTemplate = await CustomSmartWallet.new();
//                 const factory = await createCustomSmartWalletFactory(
//                     smartWalletTemplate
//                 );
//                 smartWallet = await createCustomSmartWallet(
//                     worker,
//                     senderAddress,
//                     factory,
//                     senderPrivateKey,
//                     chainId
//                 );
//                 token = await TestToken.new();
//                 recipient = await TestForwarderTarget.new();
//                 recipientFunction = recipient.contract.methods
//                     .emitMessage('hello')
//                     .encodeABI();
//             });

//             it('Should verify method verify reverts when all parameters are null', async () => {
//                 await assert.isRejected(
//                     smartWallet.verify(null, null, null, '')
//                 );
//             });

//             it('Should verify method verify reverts when all parameters are empty but the request', async () => {
//                 const initialNonce = await smartWallet.nonce();

//                 const relayRequest = await createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: initialNonce.toString(),
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAddress
//                     },
//                     relayData
//                 );
//                 await assert.isRejected(
//                     smartWallet.verify('', relayRequest.request, '')
//                 );
//             });

//             it('Should verify method verify revert because owner is not the owner of the smart wallet', async () => {
//                 //Initializing the contract
//                 const senderAccount = web3.eth.accounts.create();

//                 assert.isTrue(await smartWallet.isInitialized());

//                 const initialNonce = await smartWallet.nonce();

//                 const relayRequest = createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: initialNonce.toString(),
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAccount.address
//                     },
//                     relayData
//                 );

//                 relayRequest.relayData.callForwarder = smartWallet.address;

//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );

//                 await assert.isRejected(
//                     smartWallet.verify(
//                         suffixData,
//                         relayRequest.request,
//                         signature
//                     ),
//                     'Not the owner of the SmartWallet',
//                     'Error while validating the owner'
//                 );
//             });

//             it('Should verify method verify revert because nonce mismatch', async () => {
//                 assert.isTrue(await smartWallet.isInitialized());

//                 const relayRequest = createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: '100',
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAddress
//                     },
//                     relayData
//                 );

//                 relayRequest.relayData.callForwarder = smartWallet.address;

//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );

//                 await assert.isRejected(
//                     smartWallet.verify(
//                         suffixData,
//                         relayRequest.request,
//                         signature
//                     ),
//                     'nonce mismatch',
//                     'Error while validating data'
//                 );
//             });

//             it('Should verify method verify and revert because of signature mismatch', async () => {
//                 assert.isTrue(await smartWallet.isInitialized());

//                 const initialNonce = await smartWallet.nonce();

//                 const relayRequest = await createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: initialNonce.toString(),
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAddress
//                     },
//                     relayData
//                 );

//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );

//                 await expectRevert(
//                     smartWallet.verify(
//                         suffixData,
//                         relayRequest.request,
//                         signature
//                     ),
//                     'Signature mismatch',
//                     'Error while validating data'
//                 );
//             });

//             it('Should verify method successfully sign a txn', async () => {
//                 assert.isTrue(await smartWallet.isInitialized());

//                 const initialNonce = await smartWallet.nonce();
//                 const relayRequest = createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: initialNonce.toString(),
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAddress,
//                         value: '0',
//                         gas: '400000',
//                         tokenAmount: '0',
//                         tokenGas: '400000'
//                     },
//                     relayData
//                 );
//                 relayRequest.relayData.callForwarder = smartWallet.address;
//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );
//                 await assert.isFulfilled(
//                     smartWallet.verify(
//                         suffixData,
//                         relayRequest.request,
//                         signature
//                     )
//                 );
//             });
//         });
//     }
// );

// contract(
//     'Custom SmartWallet contract - Unit testing on execute method',
//     ([worker]) => {
//         describe('Testing execute method for values and parameters', () => {
//             let token: TestTokenInstance;
//             let senderAddress: string;
//             let smartWallet: CustomSmartWalletInstance;
//             let chainId: number;
//             const senderPrivateKey = toBuffer(generateBytes32(1));
//             let recipientFunction: any;
//             let recipient: TestForwarderTargetInstance;
//             let relayData: Partial<RelayData>;

//             beforeEach('Setting values', async () => {
//                 chainId = (await getTestingEnvironment()).chainId;
//                 senderAddress = bufferToHex(
//                     privateToAddress(senderPrivateKey)
//                 ).toLowerCase();
//                 token = await TestToken.new();
//                 recipient = await TestForwarderTarget.new();
//                 recipientFunction = recipient.contract.methods
//                     .emitMessage('hello')
//                     .encodeABI();
//                 const smartWalletTemplate = await CustomSmartWallet.new();
//                 const factory = await createCustomSmartWalletFactory(
//                     smartWalletTemplate
//                 );
//                 smartWallet = await createCustomSmartWallet(
//                     worker,
//                     senderAddress,
//                     factory,
//                     senderPrivateKey,
//                     chainId
//                 );
//                 relayData = {
//                     callForwarder: smartWallet.address
//                 };
//             });

//             it('Should verify the method executed revert to the Invalid caller', async () => {
//                 //Initializing the contract
//                 const senderAccount = web3.eth.accounts.create();

//                 assert.isTrue(await smartWallet.isInitialized());

//                 const initialNonce = await smartWallet.nonce();

//                 const relayRequest = await createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: initialNonce.toString(),
//                         relayHub: senderAddress, //To make it fail
//                         tokenContract: token.address,
//                         from: senderAccount.address
//                     },
//                     relayData
//                 );

//                 recipient = await TestForwarderTarget.new();
//                 recipientFunction = recipient.contract.methods
//                     .emitMessage('hello')
//                     .encodeABI();

//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );

//                 await assert.isRejected(
//                     smartWallet.execute(
//                         suffixData,
//                         relayRequest.request,
//                         worker,
//                         signature,
//                         { from: worker }
//                     ),
//                     'Invalid caller',
//                     'Error while validating the data'
//                 );
//             });

//             it('Should verify the method executed revert to Unable to pay relay', async () => {
//                 assert.isTrue(await smartWallet.isInitialized());

//                 const initialNonce = await smartWallet.nonce();
//                 const relayRequest = createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: initialNonce.toString(),
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAddress
//                     },
//                     relayData
//                 );

//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );

//                 await assert.isRejected(
//                     smartWallet.execute(
//                         suffixData,
//                         relayRequest.request,
//                         worker,
//                         signature,
//                         { from: worker }
//                     ),
//                     'Unable to pay for relay',
//                     'Error while validating the data'
//                 );
//             });

//             it('Should verify the method executed reverts to Not enough gas', async () => {
//                 assert.isTrue(await smartWallet.isInitialized());

//                 const initialNonce = await smartWallet.nonce();
//                 const relayRequest = createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: initialNonce.toString(),
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAddress
//                     },
//                     relayData
//                 );
//                 relayRequest.request.gas = '1000000000000000';
//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );
//                 await mintTokens(token, smartWallet.address, '1000');

//                 await assert.isRejected(
//                     smartWallet.execute(
//                         suffixData,
//                         relayRequest.request,
//                         worker,
//                         signature,
//                         { from: worker }
//                     ),
//                     'Not enough gas left',
//                     'Error while validating the data'
//                 );
//             });

//             it('Should verify the method executed success for transfer with 0 tokenAmount', async () => {
//                 assert.isTrue(await smartWallet.isInitialized());

//                 const initialNonce = await smartWallet.nonce();
//                 const relayRequest = createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: initialNonce.toString(),
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAddress
//                     },
//                     relayData
//                 );
//                 relayRequest.request.gas = '100';
//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );
//                 await mintTokens(token, smartWallet.address, '1000');

//                 await assert.isFulfilled(
//                     smartWallet.execute(
//                         suffixData,
//                         relayRequest.request,
//                         worker,
//                         signature,
//                         { from: worker }
//                     )
//                 );
//                 assert.equal(
//                     (await smartWallet.nonce()).toString(),
//                     initialNonce.add(new BN(1)).toString(),
//                     'Calling execute method should increment nonce'
//                 );
//             });

//             it('Should verify the method executed success to same sender and receiver', async () => {
//                 const transferAmount = 1000;
//                 assert.isTrue(await smartWallet.isInitialized());
//                 const initialNonce = await smartWallet.nonce();
//                 const initialBalance = getTokenBalance(token, senderAddress);
//                 const relayRequest = createRequest(
//                     {
//                         data: recipientFunction,
//                         to: senderAddress,
//                         nonce: initialNonce.toString(),
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAddress,
//                         tokenAmount: transferAmount.toString()
//                     },
//                     relayData
//                 );
//                 relayRequest.request.gas = '100';
//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );
//                 await mintTokens(
//                     token,
//                     smartWallet.address,
//                     transferAmount.toString()
//                 );

//                 await assert.isFulfilled(
//                     smartWallet.execute(
//                         suffixData,
//                         relayRequest.request,
//                         worker,
//                         signature,
//                         { from: worker }
//                     )
//                 );
//                 assert.equal(
//                     (await smartWallet.nonce()).toString(),
//                     initialNonce.add(new BN(1)).toString(),
//                     'Calling execute method should increment nonce'
//                 );
//                 assert.equal(
//                     initialBalance.toString(),
//                     getTokenBalance(token, senderAddress).toString(),
//                     'Sender balance do not match'
//                 );
//             });

//             it('Should verify balances after a transaction between accounts', async () => {
//                 const transferAmount = 1000;
//                 assert.isTrue(await smartWallet.isInitialized());
//                 const initialNonce = await smartWallet.nonce();
//                 const initialWorkerTokenBalance = await getTokenBalance(
//                     token,
//                     worker
//                 );
//                 const initialSWalletTokenBalance = await getTokenBalance(
//                     token,
//                     smartWallet.address
//                 );
//                 const relayRequest = createRequest(
//                     {
//                         data: recipientFunction,
//                         to: recipient.address,
//                         nonce: initialNonce.toString(),
//                         relayHub: worker,
//                         tokenContract: token.address,
//                         from: senderAddress,
//                         tokenAmount: transferAmount.toString()
//                     },
//                     relayData
//                 );
//                 relayRequest.request.gas = '100';

//                 const { signature, suffixData } = signRequest(
//                     senderPrivateKey,
//                     relayRequest,
//                     chainId
//                 );
//                 await mintTokens(
//                     token,
//                     smartWallet.address,
//                     transferAmount.toString()
//                 );

//                 assert.equal(
//                     (
//                         await getTokenBalance(token, smartWallet.address)
//                     ).toString(),
//                     new BN(transferAmount).toString(),
//                     'Smart wallet token balance was not increased'
//                 );

//                 await assert.isFulfilled(
//                     smartWallet.execute(
//                         suffixData,
//                         relayRequest.request,
//                         worker,
//                         signature,
//                         { from: worker }
//                     )
//                 );

//                 const tknBalance = await getTokenBalance(token, worker);
//                 const swTknBalance = await getTokenBalance(
//                     token,
//                     smartWallet.address
//                 );

//                 assert.equal(
//                     tknBalance.toString(),
//                     initialWorkerTokenBalance
//                         .add(new BN(transferAmount))
//                         .toString(),
//                     'Worker token balance did not change'
//                 );
//                 assert.equal(
//                     swTknBalance.toString(),
//                     initialSWalletTokenBalance.toString(),
//                     'Smart wallet token balance did not change'
//                 );
//                 assert.equal(
//                     (await smartWallet.nonce()).toString(),
//                     initialNonce.add(new BN(1)).toString(),
//                     'Call to execute should increment nonce'
//                 );
//             });
//         });
//     }
// );

// contract(
//     'Custom SmartWallet contract - Unit testing on directExecute method',
//     ([worker, fundedAccount]) => {
//         describe('Testing directExecute method for values and parameters', () => {
//             let customLogic: SuccessCustomLogicInstance;
//             let smartWallet: CustomSmartWalletInstance;
//             let recipientFunction: any;
//             let recipient: TestForwarderTargetInstance;
//             const fundedAccountPrivateKey: Buffer = Buffer.from(
//                 '0c06818f82e04c564290b32ab86b25676731fc34e9a546108bf109194c8e3aae',
//                 'hex'
//             );

//             beforeEach('Setting values', async () => {
//                 const chainId = (await getTestingEnvironment()).chainId;
//                 customLogic = await SuccessCustomLogic.new();
//                 recipient = await TestForwarderTarget.new();
//                 recipientFunction = recipient.contract.methods
//                     .emitMessage('hello')
//                     .encodeABI();
//                 const smartWalletTemplate = await CustomSmartWallet.new();
//                 const factory = await createCustomSmartWalletFactory(
//                     smartWalletTemplate
//                 );
//                 smartWallet = await createCustomSmartWallet(
//                     worker,
//                     fundedAccount,
//                     factory,
//                     fundedAccountPrivateKey,
//                     chainId,
//                     customLogic.address,
//                     '0x'
//                 );
//             });

//             it('Should revert call to directExecute with empty parameter', async () => {
//                 await assert.isRejected(
//                     smartWallet.directExecute('', recipientFunction, {
//                         from: fundedAccount
//                     })
//                 );
//             });

//             it('Should revert call to directExecute with null parameter', async () => {
//                 await assert.isRejected(
//                     smartWallet.directExecute(recipient.address, null, {
//                         from: fundedAccount
//                     })
//                 );
//             });

//             it('Should revert call to directExecute with no funded account as parameter', async () => {
//                 await assert.isRejected(
//                     smartWallet.directExecute(
//                         recipient.address,
//                         recipientFunction
//                     ),
//                     'Not the owner of the SmartWallet',
//                     'Error while validating the data'
//                 );
//             });

//             it('Should revert call to directExecute with INVALID_ARGUMENT as parameter', async () => {
//                 await assert.isRejected(
//                     smartWallet.directExecute('', recipientFunction, {
//                         from: fundedAccount
//                     }),
//                     'INVALID_ARGUMENT',
//                     'Error while validating the data'
//                 );
//             });

//             it('Should call successfully the method directExecute through node funded account', async () => {
//                 assert.isTrue(await smartWallet.isInitialized());
//                 const initialNonce = await smartWallet.nonce();

//                 const result = await smartWallet.directExecute(
//                     recipient.address,
//                     recipientFunction,
//                     { from: fundedAccount }
//                 );

//                 assert.equal(
//                     (await smartWallet.nonce()).toString(),
//                     initialNonce.toString(),
//                     'Call to direct execute should NOT increment nonce'
//                 );
//                 // @ts-ignore
//                 assert(
//                     containsEvent(
//                         customLogic.abi,
//                         result.receipt.rawLogs,
//                         'LogicCalled'
//                     ),
//                     'Should call custom logic'
//                 );
//             });
//         });
//     }
// );

// /* TODO - ADD tests for recover method */
import {ethers as hardhat} from 'hardhat';
import chai, { expect} from 'chai';
import {MockContract, FakeContract, smock } from '@defi-wonderland/smock';
import chaiAsPromised from 'chai-as-promised';
import { 
    CustomSmartWallet, 
    CustomSmartWalletFactory, 
    CustomSmartWallet__factory,
    ERC20} from 'typechain-types';
import {
    getLocalEip712Signature,
    getLocalEip712DeploySignature,
    TypedRequestData,
    TypedDeployRequestData} from '../utils/EIP712Utils';
import { TypedDataUtils, SignTypedDataVersion } from '@metamask/eth-sig-util';
import {Wallet} from 'ethers';
import { EnvelopingTypes, IForwarder } from 'typechain-types/contracts/RelayHub';
import { BaseProvider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {oneRBTC} from '../utils/constants';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

type ForwardRequest = IForwarder.ForwardRequestStruct;
type DeployRequest = EnvelopingTypes.DeployRequestStruct;
type DeployRequestInternal = IForwarder.DeployRequestStruct;
type RelayData = EnvelopingTypes.RelayDataStruct;
type RelayRequest = EnvelopingTypes.RelayRequestStruct;

const ZERO_ADDRESS = hardhat.constants.AddressZero;
const HARDHAT_CHAIN_ID = 31337;
const ONE_FIELD_IN_BYTES = 32;

    
function getSuffixData(typedRequestData: TypedRequestData): string {
    const encoded = TypedDataUtils.encodeData(
        typedRequestData.primaryType,
        typedRequestData.message,
        typedRequestData.types,
        SignTypedDataVersion.V4
    );

    const messageSize = Object.keys(typedRequestData.message).length;

    return '0x'+(encoded.slice(messageSize * ONE_FIELD_IN_BYTES)).toString('hex');
}

function createRequest(
    request: Partial<ForwardRequest>,
    relayData?: Partial<RelayData>
): RelayRequest {
    const baseRequest: RelayRequest = {
        request:{
            relayHub: ZERO_ADDRESS,
            from: ZERO_ADDRESS,
            to: ZERO_ADDRESS,
            tokenContract: ZERO_ADDRESS,
            value: '0',
            gas: '10000',
            nonce: '0',
            tokenAmount: '0',
            tokenGas: '50000',
            data: '0x'
        },            
        relayData:{
            gasPrice: '1',
            feesReceiver: ZERO_ADDRESS,
            callForwarder: ZERO_ADDRESS,
            callVerifier: ZERO_ADDRESS
        }
    };

    return {
        request: {
            ...baseRequest.request,
            ...request,
        },
        relayData: {
            ...baseRequest.relayData,
            ...relayData,
        }
    };
}

function createDeployRequest(
    request: Partial<DeployRequestInternal>,// & {gas: string},
    relayData?: Partial<RelayData>
): DeployRequest {
    const baseRequest = {
        request:{
            relayHub: ZERO_ADDRESS,
            from: ZERO_ADDRESS,
            to: ZERO_ADDRESS,
            tokenContract: ZERO_ADDRESS,
            recoverer: ZERO_ADDRESS,
            value: '0',
            // gas: '10000',
            nonce: '0',
            tokenAmount: '0',
            tokenGas: '50000',
            index: '0',
            data: '0x'
        },            
        relayData:{
            gasPrice: '1',
            feesReceiver: ZERO_ADDRESS,
            callForwarder: ZERO_ADDRESS,
            callVerifier: ZERO_ADDRESS
        }
    };

    return {
        request: {
            ...baseRequest.request,
            ...request,
        },
        relayData: {
            ...baseRequest.relayData,
            ...relayData,
        }
    };
}

function buildDomainSeparator(address: string ){
    const domainSeparator = {
        name: 'RSK Enveloping Transaction',
        version: '2',
        chainId: HARDHAT_CHAIN_ID,
        verifyingContract: address
    };

    return hardhat.utils._TypedDataEncoder.hashDomain(domainSeparator);
}

describe('CustomSmartWallet', function(){
    //This function is being tested as an integration test due to the lack
    //of tools for properly creating unit testing in these specific scenarios
    describe('Function initialize()', function(){
        let provider: BaseProvider;
        let owner: Wallet;
        let customSmartWalletFactory: CustomSmartWalletFactory;
        let relayHub: SignerWithAddress;
        let fakeToken: FakeContract<ERC20>;

        async function createCustomSmartWalletFactory(owner: Wallet){
            const customSmartWalletTemplateFactory = await hardhat.getContractFactory('CustomSmartWallet');
            const customSmartWalletTemplate = await customSmartWalletTemplateFactory.deploy();
    
            const customSmartWalletFactoryFactory = await hardhat.getContractFactory('CustomSmartWalletFactory');
            customSmartWalletFactory = await customSmartWalletFactoryFactory.connect(owner).deploy(customSmartWalletTemplate.address);
        }

        beforeEach(async function(){
            let fundedAccount: SignerWithAddress;
            [relayHub, fundedAccount] = await hardhat.getSigners();

            provider = hardhat.provider;
            owner = hardhat.Wallet.createRandom().connect(provider);
            
            //Fund the owner
            await fundedAccount.sendTransaction({to: owner.address, value: hardhat.utils.parseEther('1')});

            await createCustomSmartWalletFactory(owner);

            fakeToken = await smock.fake('ERC20');
        });

        it('Should initiliaze a CustomSmartWallet', async function(){
            const privateKey =  Buffer.from(owner.privateKey.substring(2, 66), 'hex');

            const toSign = hardhat.utils.solidityKeccak256(
                ['bytes2', 'address', 'address', 'address', 'uint256', 'bytes'],
                ['0x1910', owner.address, ZERO_ADDRESS, ZERO_ADDRESS, 0, '0x' ]
            );
            const toSignAsBinaryArray = hardhat.utils.arrayify(toSign);
            const signingKey = new hardhat.utils.SigningKey(privateKey);
            const signature = signingKey.signDigest(toSignAsBinaryArray);
            const signatureCollapsed = hardhat.utils.joinSignature(signature);

            await customSmartWalletFactory.createUserSmartWallet(
                owner.address,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                '0',
                '0x',
                signatureCollapsed
            );

            const customSmartWalletAddress = await customSmartWalletFactory.getSmartWalletAddress(
                owner.address,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                hardhat.utils.solidityKeccak256(['bytes'], ['0x']),
                0,
            );

            const customSmartWallet = await hardhat.getContractAt('CustomSmartWallet', customSmartWalletAddress);

            expect(await customSmartWallet.isInitialized()).to.be.true;
        });

        it('Should fail to initialize an already initilized CustomSmartWallet', async function(){
            const privateKey =  Buffer.from(owner.privateKey.substring(2, 66), 'hex');

            const toSign = hardhat.utils.solidityKeccak256(
                ['bytes2', 'address', 'address', 'address', 'uint256', 'bytes'],
                ['0x1910', owner.address, ZERO_ADDRESS, ZERO_ADDRESS, 0, '0x' ]
            );
            const toSignAsBinaryArray = hardhat.utils.arrayify(toSign);
            const signingKey = new hardhat.utils.SigningKey(privateKey);
            const signature = signingKey.signDigest(toSignAsBinaryArray);
            const signatureCollapsed = hardhat.utils.joinSignature(signature);

            await customSmartWalletFactory.createUserSmartWallet(
                owner.address,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                '0',
                '0x',
                signatureCollapsed
            );

            const customSmartWalletAddress = await customSmartWalletFactory.getSmartWalletAddress(
                owner.address,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                hardhat.utils.solidityKeccak256(['bytes'], ['0x']),
                0,
            );

            const customSmartWallet = await hardhat.getContractAt('CustomSmartWallet', customSmartWalletAddress);

            await expect(customSmartWallet.initialize(
                owner.address,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                0,
                0,
                '0x'
            )).to.be.rejectedWith('already initialized');
        });

        it('Should fail when the amount is greater than 0 and gas 0', async function(){
            const deployRequest = createDeployRequest({
                relayHub: relayHub.address,
                from: owner.address,
                nonce: '0',
                tokenGas: '0',
                tokenAmount: '10',
                tokenContract: fakeToken.address
            });
            
            const typedDeployData = new TypedDeployRequestData(HARDHAT_CHAIN_ID, customSmartWalletFactory.address, deployRequest);

            const suffixData = getSuffixData(typedDeployData);

            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
            const signature = getLocalEip712DeploySignature(typedDeployData, privateKey);
            
            await expect( 
                customSmartWalletFactory.connect(relayHub).relayedUserSmartWalletCreation(
                    deployRequest.request,
                    suffixData,
                    owner.address,
                    signature
                )
            ).to.be.rejectedWith('Unable to initialize SW');
        })
    });

    describe('Function verify()', function(){
        let mockCustomSmartWallet: MockContract<CustomSmartWallet>;
        let provider: BaseProvider;
        let owner: Wallet;

        beforeEach(async function(){
            const [, fundedAccount] = await hardhat.getSigners();

            const mockCustomSmartWalletFactory = await smock.mock<CustomSmartWallet__factory>('CustomSmartWallet');

            provider = hardhat.provider;
            owner = hardhat.Wallet.createRandom().connect(provider);

            //Fund the owner
            await fundedAccount.sendTransaction({to: owner.address, value: hardhat.utils.parseEther('1')});

            mockCustomSmartWallet = await mockCustomSmartWalletFactory.connect(owner).deploy(); 

            const domainSeparator = buildDomainSeparator(mockCustomSmartWallet.address);
            await mockCustomSmartWallet.setVariable('domainSeparator', domainSeparator);
        });

        it('Should verify a transaction', async function(){ 
            const relayRequest = createRequest({
                from: owner.address,
                nonce: '0'
            });
            
            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockCustomSmartWallet.address, relayRequest);
            
            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');

            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);
            
            await expect(
                mockCustomSmartWallet.verify(suffixData, relayRequest.request, signature)
            ).not.to.be.rejected;
        });

        it('Should fail when not called by the owner', async function(){
            const notTheOwner =  hardhat.Wallet.createRandom();
            notTheOwner.connect(provider);
            
            const relayRequest = createRequest({
                from: notTheOwner.address
            });
            
            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, notTheOwner.address, relayRequest);
            
            const privateKey = Buffer.from(notTheOwner.privateKey.substring(2, 66), 'hex');

            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);
            
            await expect(
                mockCustomSmartWallet.verify(suffixData, relayRequest.request, signature)
            ).to.be.rejectedWith('Not the owner of the SmartWallet');
        });

        it('Should fail when the nonce is wrong', async function(){
            const relayRequest = createRequest({
                from: owner.address,
                nonce: '2'
            });
            
            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, owner.address, relayRequest);
            
            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');

            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);
            
            await expect(
                mockCustomSmartWallet.verify(suffixData, relayRequest.request, signature)
            ).to.be.rejectedWith('nonce mismatch');
        });

        it('Should fail when the signature is wrong', async function(){
            const notTheOwner =  hardhat.Wallet.createRandom();
            notTheOwner.connect(provider);
            
            const relayRequest = createRequest({
                from: owner.address
            });
            
            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, owner.address, relayRequest);
            
            const privateKey = Buffer.from(notTheOwner.privateKey.substring(2, 66), 'hex');

            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);
            
            await expect(
                mockCustomSmartWallet.verify(suffixData, relayRequest.request, signature)
            ).to.be.rejectedWith('Signature mismatch');
        });
    });

    describe('Function execute()', function(){
        let mockCustomSmartWallet: MockContract<CustomSmartWallet>;
        let provider: BaseProvider;
        let owner: Wallet;
        let fakeToken: FakeContract<ERC20>;
        let relayHub: SignerWithAddress;

        beforeEach(async function(){
            let fundedAccount: SignerWithAddress;
            [, fundedAccount, relayHub] = await hardhat.getSigners();

            const mockCustomSmartWalletFactory = await smock.mock<CustomSmartWallet__factory>('CustomSmartWallet');

            provider = hardhat.provider;
            owner = hardhat.Wallet.createRandom().connect(provider);

            //Fund the owner
            await fundedAccount.sendTransaction({to: owner.address, value: hardhat.utils.parseEther('1')});

            mockCustomSmartWallet = await mockCustomSmartWalletFactory.connect(owner).deploy(); 

            const domainSeparator = buildDomainSeparator(mockCustomSmartWallet.address);
            await mockCustomSmartWallet.setVariable('domainSeparator', domainSeparator);

            fakeToken = await smock.fake('ERC20');
        });

        it('Should fail when not called by the relayHub', async function() {
            const relayRequest = createRequest({
                relayHub: relayHub.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockCustomSmartWallet.address, relayRequest);

            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
            
            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            await expect(
                mockCustomSmartWallet.execute(suffixData, relayRequest.request, owner.address, signature)
            ).to.be.rejectedWith('Invalid caller');
        });

        it('Should fail when is unable to pay for the relay', async function() {            
            fakeToken.transfer.returns(false);

            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: owner.address,
                tokenContract: fakeToken.address,
                tokenAmount: '3'
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockCustomSmartWallet.address, relayRequest);

            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
            
            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            await expect(
                mockCustomSmartWallet.connect(relayHub).execute(
                    suffixData, 
                    relayRequest.request,
                    owner.address,
                    signature
                )
            ).to.be.rejectedWith('Unable to pay for relay');
        });

        it('Should fail when gas is not enough', async function() {
            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: owner.address,
                gas: '50000000'
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockCustomSmartWallet.address, relayRequest);

            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
            
            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            await expect(
                mockCustomSmartWallet.connect(relayHub).execute(
                    suffixData, 
                    relayRequest.request,
                    owner.address,
                    signature
                )
            ).to.be.rejectedWith('Not enough gas left');
        });

        it('Should transfer when the sender and receiver are the same', async function() {
            fakeToken.transfer.returns(true);

            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: owner.address,
                to: owner.address,
                tokenContract: fakeToken.address,
                tokenAmount: '1'
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockCustomSmartWallet.address, relayRequest);

            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
            
            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            await expect(
                mockCustomSmartWallet.connect(relayHub).execute(
                    suffixData, 
                    relayRequest.request,
                    owner.address,
                    signature
                ),
                'The transaction was reverted'
            ).not.to.be.rejected;

            expect(fakeToken.transfer, 'Transfer was not called').to.be.called;
        });
    });

    describe('Function directExecute()', function(){
        let mockCustomSmartWallet: MockContract<CustomSmartWallet>;
        let provider: BaseProvider;
        let owner: Wallet;
        let recipient: FakeContract;
        let recipientFunction: string;
        let fundedAccount: SignerWithAddress

        beforeEach(async function(){
            [, fundedAccount] = await hardhat.getSigners();

            const mockCustomSmartWalletFactory = await smock.mock<CustomSmartWallet__factory>('CustomSmartWallet');

            provider = hardhat.provider;

            owner = hardhat.Wallet.createRandom().connect(provider);

            //Fund the owner
            await fundedAccount.sendTransaction({to: owner.address, value: hardhat.utils.parseEther('1')});

            mockCustomSmartWallet = await mockCustomSmartWalletFactory.connect(owner).deploy(); 

            const domainSeparator = buildDomainSeparator(mockCustomSmartWallet.address);
            await mockCustomSmartWallet.setVariable('domainSeparator', domainSeparator);

            const ABI = ['function isInitialized()'];
            const abiInterface = new hardhat.utils.Interface(ABI);

            recipient = await smock.fake('SmartWallet');
            recipient.isInitialized.returns(true);

            recipientFunction = abiInterface.encodeFunctionData('isInitialized', []);
        });

        it('Should fail when the account is not funded', async function(){
            await expect(
                mockCustomSmartWallet.directExecute(
                    recipient.address, 
                    recipientFunction,
                    {value: oneRBTC}
                )
            ).to.be.rejected;
        });

        it('Should direct execute when the account is funded', async function(){
            await fundedAccount.sendTransaction({to: owner.address, value: hardhat.utils.parseEther('10')});

            await expect(
                mockCustomSmartWallet.directExecute(
                    recipient.address, 
                    recipientFunction,
                    {value: oneRBTC}
                )
            ).not.to.be.rejected;
        });
    });

    describe.skip('Function recover()', function (){
        it('', function(){
            console.log('TODO: Implement this');
        })
    })
});
