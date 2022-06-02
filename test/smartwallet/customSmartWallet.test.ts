import { TestTokenInstance, CustomSmartWalletInstance } from '../../types/truffle-contracts';
import chai from 'chai';                                                   
import chaiAsPromised from 'chai-as-promised'; 
                                                                               
chai.use(chaiAsPromised);                                                           
const assert = chai.assert; 

const CustomSmartWallet = artifacts.require('CustomSmartWallet');
const SuccessCustomLogic = artifacts.require('SuccessCustomLogic');
const TestToken = artifacts.require('TestToken');
const  constants = {
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    worker: '0x4be48532b4ce5451b3f1b13e3bf15cb377097b24',
};

const baseRequest = {
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
        domainSeparator: '0x',
        relayWorker: constants.ZERO_ADDRESS,
        callForwarder: constants.ZERO_ADDRESS,
        callVerifier: constants.ZERO_ADDRESS
    }
};

contract.skip('Testing Custom SmartWallet contract', async () => {
    const contract = await CustomSmartWallet.deployed();
    let token: TestTokenInstance;
    let senderAddress: string;
    describe('', ()=>{
        before('Setting senderAccount and Test Token', async () => {
            //Creating a single sender account
            const senderAccount = web3.eth.accounts.create();
            senderAddress = senderAccount.address;
            token = await TestToken.new();
        });

        it('Should verify method initialize reverts with a null sender address parameter', async () =>{
            const customLogic = await SuccessCustomLogic.new();
            //Making sure the contract has not been initialized yet
            assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            assert.isRejected(contract.initialize(
            null,
            customLogic.address,
            token.address,
            constants.worker,
            '0',
            '400000',
            '0x'));
        });

        it('Should verify method initialize reverts with a ZERO sender address parameter', async () =>{
            const customLogic = await SuccessCustomLogic.new();
            //Making sure the contract has not been initialized yet
            assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            assert.isRejected(contract.initialize(
            constants.ZERO_ADDRESS,
            customLogic.address,
            token.address,
            constants.worker,
            '0',
            '400000',
            '0x'));
        });

        it('Should verify method initialize successfully return the correct boolean value', async () =>{
            const customLogic = await SuccessCustomLogic.new();
            //Making sure the contract has not been initialized yet
            //assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            await contract.initialize(
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '0',
            '400000',
            '0x');
            //After initilization is complete the method should return true
            assert.equal(await contract.isInitialized(), true);
        });
        //it('execute and verify', ()=>{
    });
});

contract.skip('Test that needs to be verified revised by DEV team', async () => {
    const contract = await CustomSmartWallet.deployed();
    let token: TestTokenInstance;
    let senderAddress: string;
    describe('', ()=> {
        before('Setting senderAccount and Test Token', async () => {
            //Creating a single sender account
            const senderAccount = web3.eth.accounts.create();
            senderAddress = senderAccount.address;
            token = await TestToken.new();
        });

        it('Should verify method initialize reverts with a null token address parameter', async () =>{
            const customLogic = await SuccessCustomLogic.new();
            //Making sure the contract has not been initialized yet
            assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            assert.isRejected(contract.initialize(  //TODO Verify if this scenario should be handled since we are sending an invalid value as Token Address
            senderAddress,
            customLogic.address,
            null,
            constants.worker,
            '0',
            '400000',
            '0x'));
        });

        it('Should verify method initialize reverts with token as 0x address parameter', async () =>{
            const customLogic = await SuccessCustomLogic.new();
            //Making sure the contract has not been initialized yet
            assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            assert.isRejected(contract.initialize( //TODO Verify if this scenario should be handled since we are sending an invalid value as Token Address
            senderAddress,
            customLogic.address,
            constants.ZERO_ADDRESS,
            constants. worker,
            '0',
            '400000',
            '0x'));
        });

        it('Should verify method initialize reverts with worker address as null parameter', async () =>{
            const customLogic = await SuccessCustomLogic.new();
            //Making sure the contract has not been initialized yet
            assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            assert.isRejected(contract.initialize(
            senderAddress,
            customLogic.address,
            token.address,
            null,
            '0',
            '400000',
            '0x'));
        });

        it('Should verify method initialize reverts with all address type parameters as zero address', async () =>{
            //Making sure the contract has not been initialized yet
            assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            assert.isRejected(contract.initialize(
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS,
            '0',
            '400000',
            '0x'));
        });

        it('Should verify method initialize reverts with gas amount as null', async () =>{
            const customLogic = await SuccessCustomLogic.new();
            //Making sure the contract has not been initialized yet
            assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            assert.isRejected(contract.initialize( //TODO this scenario should ve verified first
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '0',
            null,
            '0x'));
        });

        it('Should verify method initialize reverts with negative gas amount', async () =>{
            const customLogic = await SuccessCustomLogic.new();
            //Making sure the contract has not been initialized yet
            assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            assert.isRejected(contract.initialize( //TODO this scenario should ve verified first
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '0',
            '-400000',
            '0x'));
        });

        it('Should verify method initialize reverts with negative gas amount', async () =>{
            const customLogic = await SuccessCustomLogic.new();
            //Making sure the contract has not been initialized yet
            assert.equal(await contract.isInitialized(), false);
            //Initializaing the contract
            assert.isRejected(contract.initialize( //TODO this scenario should ve verified first
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '-2',
            '400000',
            '0x'));
        });
    });
});

contract('Testing Custom smart wallet', async () => {
    const contract = await CustomSmartWallet.deployed();
    let senderAddress: string;
    let smartWallet: CustomSmartWalletInstance;

    describe('Testing verify method', () => {

        before('Setting senderAccount and Test Token', async () => {
        const senderAccount = web3.eth.accounts.create();
            senderAddress = senderAccount.address;
            smartWallet = await CustomSmartWallet.new();
        });

        it('Should verify method verif reverts when all parameters are null', () => {
            assert.isRejected(contract.verify(
                null,
                null,
                null,
                ''
            ));
        });

        it('Should verify method verif reverts when all parameters are empty but the request', () => {
            assert.isRejected(contract.verify(
                '',
                '',
                baseRequest.request,
                ''
            ));
        });

        it('Should verify method verif reverts when all parameters are null but the request', () => {
            baseRequest.request.from = smartWallet.address;
            contract.verify(
                'Test 1',
                senderAddress,
                baseRequest.request,
                ''
            );
        });

    });
});