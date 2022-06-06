// import { SmartWalletInstance, TestTokenInstance } from '../../types/truffle-contracts';

// const SmartWallet = artifacts.require('SmartWallet');
// const TestToken = artifacts.require('TestToken');
// const  constants = {
//     ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
//     worker: '0x4be48532b4ce5451b3f1b13e3bf15cb377097b24',
// };

// contract.skip('Testing SmartWallet contract', async () => {
//     let contract: SmartWalletInstance;
//     let token: TestTokenInstance;
//     let senderAddress: string;
//     describe('Testing ', () => {
//         before('Setting senderAccount and Test Token', async () => {
//             //Creating a single sender account
//             //contract = await SmartWallet.deployed();
//             const senderAccount = web3.eth.accounts.create();
//             senderAddress = senderAccount.address;
//             token = await TestToken.new();
//         });

//         it('Should verify method initialize reverts with a null sender address parameter', async () =>{
//             //Making sure the contract has not been initialized yet
//             assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             assert.isRejected(contract.initialize(
//             null,
//             token.address,
//             constants.worker,
//             '0',
//             '400000'));
//         });

//         it('Should verify method initialize reverts with a ZERO sender address parameter', async () =>{
//             //Making sure the contract has not been initialized yet
//             assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             assert.isRejected(contract.initialize(
//             constants.ZERO_ADDRESS,
//             token.address,
//             constants.worker,
//             '0',
//             '400000'));
//         });

//         it('Should verify method initialize successfully return the correct boolean value', async () =>{
//             //Making sure the contract has not been initialized yet
//             //assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             await contract.initialize(
//             senderAddress,
//             token.address,
//             constants.worker,
//             '0',
//             '400000');
//             //After initilization is complete the method should return true
//             assert.equal(await contract.isInitialized(), true);
//         });
//         //it('execute and verify', ()=>{
//     });
// });

// contract.skip('Test that needs to be verified revised by DEV team', async () => {
//     const contract = await SmartWallet.deployed();
//     let token: TestTokenInstance;
//     let senderAddress: string;
//     describe('', ()=> {
//         before('Setting senderAccount and Test Token', async () => {
//             //Creating a single sender account
//             const senderAccount = web3.eth.accounts.create();
//             senderAddress = senderAccount.address;
//             token = await TestToken.new();
//         });

//         it('Should verify method initialize reverts with a null token address parameter', async () =>{
//             //Making sure the contract has not been initialized yet
//             assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             assert.isRejected(contract.initialize(  //TODO Verify if this scenario should be handled since we are sending an invalid value as Token Address
//             senderAddress,
//             null,
//             constants.worker,
//             '0',
//             '400000'));
//         });

//         it('Should verify method initialize reverts with token as 0x address parameter', async () =>{
//             //Making sure the contract has not been initialized yet
//             assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             assert.isRejected(contract.initialize( //TODO Verify if this scenario should be handled since we are sending an invalid value as Token Address
//             senderAddress,
//             constants.ZERO_ADDRESS,
//             constants. worker,
//             '0',
//             '400000'));
//         });

//         it('Should verify method initialize reverts with worker address as null parameter', async () =>{
//             //Making sure the contract has not been initialized yet
//             assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             assert.isRejected(contract.initialize(
//             senderAddress,
//             token.address,
//             null,
//             '0',
//             '400000'));
//         });

//         it('Should verify method initialize reverts with all address type parameters as zero address', async () =>{
//             //Making sure the contract has not been initialized yet
//             assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             assert.isRejected(contract.initialize(
//             constants.ZERO_ADDRESS,
//             constants.ZERO_ADDRESS,
//             constants.ZERO_ADDRESS,
//             '0',
//             '400000',));
//         });

//         it('Should verify method initialize reverts with gas amount as null', async () =>{
//             //Making sure the contract has not been initialized yet
//             assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             assert.isRejected(contract.initialize( //TODO this scenario should ve verified first
//             senderAddress,
//             token.address,
//             constants.worker,
//             '0',
//             null));
//         });

//         it('Should verify method initialize reverts with negative gas amount', async () =>{
//             //Making sure the contract has not been initialized yet
//             assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             assert.isRejected(contract.initialize( //TODO this scenario should ve verified first
//             senderAddress,
//             token.address,
//             constants.worker,
//             '0',
//             '-400000'));
//         });

//         it('Should verify method initialize reverts with negative gas amount', async () =>{
//             //Making sure the contract has not been initialized yet
//             assert.equal(await contract.isInitialized(), false);
//             //Initializaing the contract
//             assert.isRejected(contract.initialize( //TODO this scenario should ve verified first
//             senderAddress,
//             token.address,
//             constants.worker,
//             '-2',
//             '400000'));
//         });
//     });
// });
