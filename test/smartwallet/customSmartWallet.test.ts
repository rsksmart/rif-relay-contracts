import { TestTokenInstance, CustomSmartWalletInstance, SuccessCustomLogicInstance } from '../../types/truffle-contracts';
import { getDomainSeparatorHash } from '../ExportUtils';
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
const NETWORK_ID = 33;

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

contract('Testing Custom SmartWallet contract', () => {
    let token: TestTokenInstance;
    let senderAddress: string;
    let contract: CustomSmartWalletInstance;
    let customLogic: SuccessCustomLogicInstance;
    let smartWallet: CustomSmartWalletInstance;

    describe.skip('Testing initialize and isInitialize methods and values for parameters', () => {
        beforeEach('Setting senderAccount, Contract instance and Test Token', async () => {
            //Creating a single sender account
            contract = await CustomSmartWallet.new();
            customLogic = await SuccessCustomLogic.new();
            const senderAccount = web3.eth.accounts.create();
            senderAddress = senderAccount.address;
            token = await TestToken.new();
        });

        it('Should verify method initialize fails with a null sender address parameter', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isRejected(contract.initialize(
            null,
            customLogic.address,
            token.address,
            constants.worker,
            '0',
            '400000',
            '0x'));

            assert.isFalse(await contract.isInitialized());
        });

        it('Should verify method initialize fails with a ZERO owner address parameter', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isRejected(contract.initialize(
            constants.ZERO_ADDRESS,
            customLogic.address,
            token.address,
            constants.worker,
            '10',
            '400000',
            '0x'), 'Unable to pay for deployment');

            assert.isFalse(await contract.isInitialized());
        });

        it('Should verify method initialize fails with a null token address parameter', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isRejected(contract.initialize(
            senderAddress,
            customLogic.address,
            null,
            constants.worker,
            '0',
            '400000',
            '0x'));

            assert.isFalse(await contract.isInitialized());
        });

        it('Should verify method initialize reverts with negative gas amount', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isRejected(contract.initialize(
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '100',
            '-400000',
            '0x'));
        });

        it('Should verify method initialize reverts with negative token amount', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isRejected(contract.initialize(
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '-2',
            '400000',
            '0x'));
        });

        it('Should verify method initialize sucessfully with token as 0x address parameter', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isFulfilled(contract.initialize(
            senderAddress,
            customLogic.address,
            constants.ZERO_ADDRESS,
            constants. worker,
            '0',
            '400000',
            '0x'));

            assert.isTrue(await contract.isInitialized());
        });

        it('Should verify method initialize sucessfully with worker address as null parameter', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isRejected(contract.initialize(
            senderAddress,
            customLogic.address,
            token.address,
            null,
            '0',
            '400000',
            '0x'));

            assert.isFalse(await contract.isInitialized());
        });

        it('Should verify method initialize reverts with gas amount as null', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isRejected(contract.initialize( //TODO this scenario should ve verified first
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '0',
            null,
            '0x'));

            assert.isFalse(await contract.isInitialized());
        });

        it('Should verify method initialize sucessfully with all address type parameters as zero address', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isFulfilled(contract.initialize(
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS,
            '0',
            '400000',
            '0x'));

            assert.isTrue(await contract.isInitialized());
        });

        it('Should verify method initialize successfully return with 0 tokens', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isFulfilled (contract.initialize(
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '0',
            '400000',
            '0x'));

            //After initilization is complete the method should return true
            assert.isTrue(await contract.isInitialized());
        });

        it('Should verify method initialize fails due to amount greater than 0 and gas less than 0', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            
            //Initializaing the contract
            await assert.isRejected(contract.initialize(
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '10',
            '-0',
            '0x'), 'Unable to pay for deployment');
            
            //After initilization is complete the method should return true
            assert.equal(await contract.isInitialized(), false);
        });

        it('Should verify method initialize fails due to amount greater than 0 and ZERO token address', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isRejected (contract.initialize(
            senderAddress,
            customLogic.address,
            constants.ZERO_ADDRESS,
            constants.worker,
            '10',
            '-400000',
            '0x'));
            //After initilization is complete the method should return true
            assert.isFalse(await contract.isInitialized());
        });

        it('Should verify method initialize successfully when owner does not have funds to pay', async () =>{
            //Making sure the contract has not been initialized yet
            assert.isFalse(await contract.isInitialized());
            //Initializaing the contract
            await assert.isRejected (contract.initialize(
            senderAddress,
            customLogic.address,
            constants.ZERO_ADDRESS,
            constants.worker,
            '10',
            '-400000',
            '0x'));
            //After initilization is complete the method should return true
            assert.isFalse(await contract.isInitialized());
        });
        //TODO might need to include scenarios where the logic address is not 0x
    });

    describe('Testing verify method', () => {

        beforeEach('Setting senderAccount and Test Token', async () => {
            const senderAccount = web3.eth.accounts.create();
            senderAddress = senderAccount.address;

            smartWallet = await CustomSmartWallet.new();
            customLogic = await SuccessCustomLogic.new();
            senderAddress = senderAccount.address;
            token = await TestToken.new();
        });

        it('Should verify method verify reverts when all parameters are null', async () => {
            await assert.isRejected(smartWallet.verify(
                null,
                null,
                null,
                ''
            ));
        });

        it('Should verify method verify reverts when all parameters are empty but the request', async () => {
            await assert.isRejected(smartWallet.verify(
                '',
                '',
                baseRequest.request,
                ''
            ));
        });

        it('Should verify method verify sucessfully when all parameters are valid', async () => {
            assert.isFalse(await smartWallet.isInitialized());
            //Initializaing the contract
            await assert.isFulfilled (smartWallet.initialize(
            senderAddress,
            customLogic.address,
            token.address,
            constants.worker,
            '0',
            '400000',
            '0x'));
            
            assert.isTrue(await smartWallet.isInitialized());
            
            const domainSeparatorHash = getDomainSeparatorHash(
                smartWallet.address,
                NETWORK_ID);
            baseRequest.request.from = smartWallet.address;
            await smartWallet.verify(
                domainSeparatorHash,
                'Test',
                baseRequest.request,
                ''
            );
        });

    });
});