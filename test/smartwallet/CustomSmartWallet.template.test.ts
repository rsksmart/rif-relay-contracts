// import { use, expect } from 'chai';
// import chaiAsPromised from 'chai-as-promised';

// import { CustomSmartWalletInstance } from '../../types/truffle-contracts';
// import { constants } from '../constants';

// use(chaiAsPromised);

// const CustomSmartWallet = artifacts.require('CustomSmartWallet');

// contract('CustomSmartWallet - template', ([owner]) => {
//     describe('initialize', function() {
//         let smartWallet: CustomSmartWalletInstance;

//         beforeEach(async function() {
//             smartWallet = await CustomSmartWallet.new();
//         });

//         it('Should be initialized during the deployment', async function() {
//             await expect(smartWallet.isInitialized()).to.eventually.be.true;
//         });

//         it('Should verify method initialize fails when contract has already deployed', async function() {
//             const logicAddress = constants.ZERO_ADDRESS;
//             const initParams = '0x';
//             const tokenAddress = constants.ZERO_ADDRESS;
//             const recipient = constants.ZERO_ADDRESS;

//             await expect(
//                 smartWallet.initialize(
//                     owner,
//                     logicAddress,
//                     tokenAddress,
//                     recipient,
//                     '0',
//                     '5000',
//                     initParams
//                 )
//             ).to.be.rejectedWith('already initialized');
//         });
//     });
// });
