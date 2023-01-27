// import { use, expect } from 'chai';
// import chaiAsPromised from 'chai-as-promised';
// import { ethers } from 'ethers';
// import { soliditySha3Raw } from 'web3-utils';
// import {
//     CustomSmartWalletFactoryInstance,
//     CustomSmartWalletInstance,
//     TestTokenInstance
// } from '../../types/truffle-contracts';
// import { constants } from '../constants';
// import {
//     createRequest,
//     getGaslessAccount,
//     getTestingEnvironment,
//     getTokenBalance,
//     mintTokens,
//     signRequest
// } from '../utils';

// use(chaiAsPromised);

// const CustomSmartWallet = artifacts.require('CustomSmartWallet');
// const CustomSmartWalletFactory = artifacts.require('CustomSmartWalletFactory');
// const TestToken = artifacts.require('TestToken');

// type createUserSmartWalletParam = {
//     owner: string;
//     recoverer: string;
//     logicAddress: string;
//     index: string;
//     initParams: string;
// };

// /**
//  * Function to get the actual token balance for an account
//  * @param owner.address
//  * @param ownerPrivateKey
//  * @param recoverer
//  * @param logicAddress
//  * @param index
//  * @param initParams
//  * @returns The createUserSmartWallet signed
//  */
// function createUserSmartWalletSignature(
//     ownerPrivateKey: Buffer,
//     object: createUserSmartWalletParam
// ): string {
//     const { owner, recoverer, logicAddress, index, initParams } = object;

//     const toSign: string =
//         web3.utils.soliditySha3(
//             { t: 'bytes2', v: '0x1910' },
//             { t: 'address', v: owner },
//             { t: 'address', v: recoverer },
//             { t: 'address', v: logicAddress },
//             { t: 'uint256', v: index },
//             { t: 'bytes', v: initParams }
//         ) ?? '';
//     const toSignAsBinaryArray = ethers.utils.arrayify(toSign);
//     const signingKey = new ethers.utils.SigningKey(ownerPrivateKey);
//     const signature = signingKey.signDigest(toSignAsBinaryArray);
//     const signatureCollapsed = ethers.utils.joinSignature(signature);

//     return signatureCollapsed;
// }

// contract('CustomSmartWalletFactory', ([worker, otherAccount]) => {
//     let chainId: number;
//     let factory: CustomSmartWalletFactoryInstance;
//     let owner;

//     describe('createUserSmartWallet', async () => {
//         const logicAddress = constants.ZERO_ADDRESS;
//         const initParams = '0x';
//         const recoverer = constants.ZERO_ADDRESS;
//         const index = '0';

//         beforeEach(async () => {
//             owner = await getGaslessAccount();
//             chainId = (await getTestingEnvironment()).chainId;
//             const smartWallet = await CustomSmartWallet.new();
//             factory = await CustomSmartWalletFactory.new(smartWallet.address);
//         });

//         it('Should initiate the smart wallet in the expected address', async () => {
//             const smartWalletAddress = await factory.getSmartWalletAddress(
//                 owner.address,
//                 recoverer,
//                 logicAddress,
//                 soliditySha3Raw({ t: 'bytes', v: initParams }),
//                 index
//             );

//             await expect(
//                 CustomSmartWallet.at(smartWalletAddress)
//             ).to.be.rejectedWith(
//                 `Cannot create instance of CustomSmartWallet; no code at address ${smartWalletAddress}`
//             );

//             const signatureCollapsed = createUserSmartWalletSignature(
//                 owner.privateKey,
//                 {
//                     owner: owner.address,
//                     recoverer,
//                     logicAddress,
//                     initParams,
//                     index
//                 }
//             );

//             await factory.createUserSmartWallet(
//                 owner.address,
//                 recoverer,
//                 logicAddress,
//                 index,
//                 initParams,
//                 signatureCollapsed
//             );

//             const smartWallet: CustomSmartWalletInstance =
//                 await CustomSmartWallet.at(smartWalletAddress);

//             await expect(smartWallet.isInitialized()).to.eventually.be.true;
//         });

//         it('Should fail with a ZERO owner address parameter', async () => {
//             const signatureCollapsed = createUserSmartWalletSignature(
//                 owner.privateKey,
//                 {
//                     owner: constants.ZERO_ADDRESS,
//                     recoverer,
//                     logicAddress,
//                     initParams,
//                     index
//                 }
//             );

//             await expect(
//                 factory.createUserSmartWallet(
//                     constants.ZERO_ADDRESS,
//                     recoverer,
//                     logicAddress,
//                     index,
//                     initParams,
//                     signatureCollapsed
//                 )
//             ).to.be.rejectedWith(
//                 'Returned error: VM Exception while processing transaction: revert Invalid signature'
//             );
//         });

//         it('Should fail when signature does not match', async () => {
//             const signatureCollapsed = createUserSmartWalletSignature(
//                 owner.privateKey,
//                 {
//                     owner: owner.address,
//                     recoverer,
//                     logicAddress,
//                     initParams,
//                     index
//                 }
//             );

//             await expect(
//                 factory.createUserSmartWallet(
//                     otherAccount,
//                     recoverer,
//                     logicAddress,
//                     index,
//                     initParams,
//                     signatureCollapsed
//                 )
//             ).to.be.rejectedWith(
//                 'Returned error: VM Exception while processing transaction: revert Invalid signature'
//             );
//         });
//     });

//     describe('relayedUserSmartWalletCreation', () => {
//         let smartWalletAddress: string;
//         let token: TestTokenInstance;
//         const logicAddress = constants.ZERO_ADDRESS;
//         const initParams = '0x';
//         const recoverer = constants.ZERO_ADDRESS;
//         const index = '0';

//         beforeEach(async () => {
//             chainId = (await getTestingEnvironment()).chainId;
//             const smartWallet = await CustomSmartWallet.new();
//             factory = await CustomSmartWalletFactory.new(smartWallet.address);
//         });

//         beforeEach(async () => {
//             token = await TestToken.new();
//             smartWalletAddress = await factory.getSmartWalletAddress(
//                 owner.address,
//                 recoverer,
//                 logicAddress,
//                 soliditySha3Raw({ t: 'bytes', v: initParams }),
//                 index
//             );
//         });

//         it('Should initialize the smart wallet in the expected address without paying fee', async () => {
//             const initialWorkerBalance = await getTokenBalance(token, worker);
//             expect(initialWorkerBalance.toString()).to.be.equal('0');

//             await expect(
//                 CustomSmartWallet.at(smartWalletAddress)
//             ).to.be.rejectedWith(
//                 `Cannot create instance of CustomSmartWallet; no code at address ${smartWalletAddress}`
//             );

//             const relayRequest = createRequest(
//                 {
//                     from: owner.address,
//                     to: logicAddress,
//                     data: initParams,
//                     tokenContract: token.address,
//                     tokenAmount: '0',
//                     tokenGas: '0',
//                     recoverer: recoverer,
//                     index: index,
//                     relayHub: worker
//                 },
//                 {
//                     callForwarder: factory.address
//                 }
//             );

//             const { signature, suffixData } = signRequest(
//                 owner.privateKey,
//                 relayRequest,
//                 chainId
//             );

//             await factory.relayedUserSmartWalletCreation(
//                 relayRequest.request,
//                 suffixData,
//                 worker,
//                 signature,
//                 {
//                     from: worker
//                 }
//             );

//             const smartWallet: CustomSmartWalletInstance =
//                 await CustomSmartWallet.at(smartWalletAddress);

//             await expect(smartWallet.isInitialized()).to.eventually.be.true;

//             const finalWorkerBalance = await getTokenBalance(token, worker);
//             await expect(finalWorkerBalance.toString()).to.be.equal('0');
//         });

//         it('Should initialize the smart wallet in the expected address paying fee', async () => {
//             const initialWorkerBalance = await getTokenBalance(token, worker);
//             expect(initialWorkerBalance.toString()).to.be.equal('0');

//             await mintTokens(token, smartWalletAddress, '1000');
//             const fee = '500';

//             const relayRequest = createRequest(
//                 {
//                     from: owner.address,
//                     to: logicAddress,
//                     data: initParams,
//                     tokenContract: token.address,
//                     tokenAmount: fee,
//                     tokenGas: '50000',
//                     recoverer: recoverer,
//                     index: index,
//                     relayHub: worker
//                 },
//                 {
//                     callForwarder: factory.address
//                 }
//             );

//             const { signature, suffixData } = signRequest(
//                 owner.privateKey,
//                 relayRequest,
//                 chainId
//             );

//             await factory.relayedUserSmartWalletCreation(
//                 relayRequest.request,
//                 suffixData,
//                 worker,
//                 signature,
//                 {
//                     from: worker
//                 }
//             );

//             const smartWallet: CustomSmartWalletInstance =
//                 await CustomSmartWallet.at(smartWalletAddress);

//             await expect(smartWallet.isInitialized()).to.eventually.be.true;

//             const finalWorkerBalance = await getTokenBalance(token, worker);
//             await expect(finalWorkerBalance.toString()).to.be.equal(fee);
//         });

//         it('Should fail with negative token amount', async () => {
//             const relayRequest = createRequest(
//                 {
//                     from: owner.address,
//                     to: logicAddress,
//                     data: initParams,
//                     tokenContract: token.address,
//                     tokenAmount: '-100',
//                     tokenGas: '0',
//                     recoverer: recoverer,
//                     index: index,
//                     relayHub: worker
//                 },
//                 {
//                     callForwarder: factory.address
//                 }
//             );

//             expect(() =>
//                 signRequest(owner.privateKey, relayRequest, chainId)
//             ).to.throw('Supplied uint is negative');
//         });

//         it('Should fail with token as ZERO address parameter', async () => {
//             const relayRequest = createRequest(
//                 {
//                     from: owner.address,
//                     to: logicAddress,
//                     data: initParams,
//                     tokenContract: constants.ZERO_ADDRESS,
//                     tokenAmount: '5000',
//                     tokenGas: '0',
//                     recoverer: recoverer,
//                     index: index,
//                     relayHub: worker
//                 },
//                 {
//                     callForwarder: factory.address
//                 }
//             );

//             const { signature, suffixData } = signRequest(
//                 owner.privateKey,
//                 relayRequest,
//                 chainId
//             );

//             await factory.relayedUserSmartWalletCreation(
//                 relayRequest.request,
//                 suffixData,
//                 worker,
//                 signature,
//                 {
//                     from: worker
//                 }
//             );
//             const smartWallet: CustomSmartWalletInstance =
//                 await CustomSmartWallet.at(smartWalletAddress);

//             await expect(smartWallet.isInitialized()).to.eventually.be.true;
//         });

//         it('Should fail when owner does not have funds to pay', async () => {
//             const relayRequest = createRequest(
//                 {
//                     from: owner.address,
//                     to: logicAddress,
//                     data: initParams,
//                     tokenContract: token.address,
//                     tokenAmount: '5000',
//                     tokenGas: '0',
//                     recoverer: recoverer,
//                     index: index,
//                     relayHub: worker
//                 },
//                 {
//                     callForwarder: factory.address
//                 }
//             );

//             const { signature, suffixData } = signRequest(
//                 owner.privateKey,
//                 relayRequest,
//                 chainId
//             );

//             await expect(
//                 factory.relayedUserSmartWalletCreation(
//                     relayRequest.request,
//                     suffixData,
//                     worker,
//                     signature,
//                     {
//                         from: worker
//                     }
//                 )
//             ).to.be.rejectedWith(
//                 'Returned error: VM Exception while processing transaction: revert Unable to initialize SW'
//             );
//         });

//         it('Should fail when invalid caller(Not relayHub)', async () => {
//             const relayRequest = createRequest(
//                 {
//                     from: owner.address,
//                     to: logicAddress,
//                     data: initParams,
//                     tokenContract: token.address,
//                     tokenAmount: '5000',
//                     tokenGas: '0',
//                     recoverer: recoverer,
//                     index: index,
//                     relayHub: otherAccount
//                 },
//                 {
//                     callForwarder: factory.address
//                 }
//             );

//             const { signature, suffixData } = signRequest(
//                 owner.privateKey,
//                 relayRequest,
//                 chainId
//             );

//             await expect(
//                 factory.relayedUserSmartWalletCreation(
//                     relayRequest.request,
//                     suffixData,
//                     worker,
//                     signature,
//                     {
//                         from: worker
//                     }
//                 )
//             ).to.be.rejectedWith(
//                 'Returned error: VM Exception while processing transaction: revert Invalid caller'
//             );
//         });

//         it('Should fail when nonce does not match', async () => {
//             const relayRequest = createRequest(
//                 {
//                     from: owner.address,
//                     to: logicAddress,
//                     data: initParams,
//                     tokenContract: token.address,
//                     tokenAmount: '5000',
//                     tokenGas: '0',
//                     recoverer: recoverer,
//                     index: index,
//                     relayHub: worker,
//                     nonce: '1'
//                 },
//                 {
//                     callForwarder: factory.address
//                 }
//             );

//             const { signature, suffixData } = signRequest(
//                 owner.privateKey,
//                 relayRequest,
//                 chainId
//             );

//             await expect(
//                 factory.relayedUserSmartWalletCreation(
//                     relayRequest.request,
//                     suffixData,
//                     worker,
//                     signature,
//                     {
//                         from: worker
//                     }
//                 )
//             ).to.be.rejectedWith(
//                 'Returned error: VM Exception while processing transaction: revert nonce mismatch'
//             );
//         });

//         it('Should fail when signature does not match', async () => {
//             const relayRequest = createRequest(
//                 {
//                     from: owner.address,
//                     to: logicAddress,
//                     data: initParams,
//                     tokenContract: token.address,
//                     tokenAmount: '5000',
//                     tokenGas: '0',
//                     index: index,
//                     relayHub: worker
//                 },
//                 {
//                     callForwarder: factory.address
//                 }
//             );

//             const { signature, suffixData } = signRequest(
//                 owner.privateKey,
//                 relayRequest,
//                 chainId
//             );

//             relayRequest.request.from = otherAccount;

//             await expect(
//                 factory.relayedUserSmartWalletCreation(
//                     relayRequest.request,
//                     suffixData,
//                     worker,
//                     signature,
//                     {
//                         from: worker
//                     }
//                 )
//             ).to.be.rejectedWith(
//                 'Returned error: VM Exception while processing transaction: revert Signature mismatch'
//             );
//         });
//     });
// });
