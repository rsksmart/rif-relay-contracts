import { ethers as hardhat } from 'hardhat';
// import {ethers} from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect} from 'chai';
import { FakeContract, smock } from '@defi-wonderland/smock';
import chaiAsPromised from 'chai-as-promised';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { TypedDataUtils } from '@metamask/eth-sig-util';
import {
    getLocalEip712Signature,
    TypedRequestData,
    RelayRequest,
    ForwardRequest,
    RelayData} from '../utils/EIP712Utils';
import { SignTypedDataVersion } from '@metamask/eth-sig-util';
import { Wallet } from 'ethers';
import { SmartWallet } from 'typechain-types';
import { BaseProvider } from '@ethersproject/providers';
// import { AbiCoder } from 'ethers/lib/utils';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = hardhat.constants.AddressZero;
const ONE_FIELD_IN_BYTES = 32;

describe('SmartWallet', function(){
    function createRequest(
        request: Partial<ForwardRequest>,
        relayData: Partial<RelayData>
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
            } as ForwardRequest,            
            relayData:{
                gasPrice: '1',
                relayWorker: ZERO_ADDRESS,
                callForwarder: ZERO_ADDRESS,
                callVerifier: ZERO_ADDRESS
            } as RelayData
        } as RelayRequest

        return {
            request: {
                ...baseRequest.request,
                ...request,
            },
            relayData: {
                ...baseRequest.relayData,
                ...relayData,
            }
        }
    }
    
    function getSuffixData(typedRequestData: TypedRequestData):string{
        const encoded =TypedDataUtils.encodeData(
            typedRequestData.primaryType,
            typedRequestData.message,
            typedRequestData.types,
            SignTypedDataVersion.V4
        );

        const messageSize = Object.keys(typedRequestData.message).length;

        return '0x'+(encoded.slice(messageSize * ONE_FIELD_IN_BYTES)).toString('hex');
    }

    describe('Function initialize()', function(){
        let fakeToken:FakeContract;

        async function prepareFixture(){
            const smartWalletFactory =await hardhat.getContractFactory('SmartWallet');
            const smartWallet = await smartWalletFactory.deploy();
            const [owner, worker, utilSigner] = await hardhat.getSigners();
        
            return {smartWallet, owner, worker, utilSigner};
        }

        beforeEach(async function(){
            fakeToken = await smock.fake('ERC20');
            fakeToken.transfer.returns(true);
        });

        it('Should initialize with the correct parameters', async function () {
            const  {smartWallet, owner, worker} = await loadFixture(prepareFixture);

            expect(await smartWallet.isInitialized(), 'Contract already initialized').to.be.false;

            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000);
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;            
        });

        //TODO: not working as expected
        it.skip('Should fail with zero address as owner', async function () {
            const {smartWallet, worker} = await loadFixture(prepareFixture);

            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.false;

            await smartWallet.initialize(ZERO_ADDRESS, fakeToken.address, worker.address, 10, 400000);

            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.false;
        });

        //TODO: Really?
        it.skip('Should initialize the contract with 0x as token address', async function(){
            const {smartWallet, owner, worker} = await loadFixture(prepareFixture);
            await smartWallet.initialize(owner.address, ZERO_ADDRESS, worker.address, 10, 400000);

            expect(await smartWallet.isInitialized()).to.be.true;
        });

        //TODO: not working as expected
        it.skip('Should fail in sponsored transaction when the worker is zero', async function () {
            const  {smartWallet, owner} = await loadFixture(prepareFixture);

            expect(await smartWallet.isInitialized(), 'Contract already initialized').to.be.false;

            await smartWallet.initialize(owner.address, fakeToken.address, ZERO_ADDRESS, 10, 400000);
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.false;            
        });

        it('Should call transfer on NOT sponsored deployment', async function(){
            const {smartWallet, owner, worker} = await loadFixture(prepareFixture);

            expect(await smartWallet.isInitialized(), 'Contract already initialized').to.be.false;

            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000);
            expect(fakeToken.transfer).to.be.called;
        });

        it('Should not call transfer on sponsored deployment', async function(){
            const {smartWallet, utilSigner, worker} = await loadFixture(prepareFixture);

            expect(await smartWallet.isInitialized(), 'Contract already initialized').to.be.false;

            await smartWallet.initialize(utilSigner.address, fakeToken.address, worker.address, 0, 0);

            expect(fakeToken.transfer).not.to.be.called;
        });

        //TODO: Not working as expected
        it.skip('Should revert not sponsored deployment transaction if gas fee is 0', async function(){
            const {smartWallet, owner, worker} = await loadFixture(prepareFixture);

            expect(await smartWallet.isInitialized(), 'Contract already initialized').to.be.false;

            await expect(
                smartWallet.initialize(owner.address, fakeToken.address, worker.address, 100, 0)
            ).to.be.revertedWith('Unable to pay for deployment');
            
        });

        //TODO: Not working as expected
        it.skip('Should revert not sponsored deployment transaction if no worker was specified', async function(){
            const {smartWallet, owner} = await loadFixture(prepareFixture);

            expect(await smartWallet.isInitialized(), 'Contract already initialized').to.be.false;

            await expect(
                smartWallet.initialize(owner.address, fakeToken.address, ZERO_ADDRESS, 10, 400000)
            ).to.be.revertedWith('Unable to pay for deployment');
        });

        it('Should fail to initialize a contract when it is already initialized', async function(){
            const {smartWallet, owner, worker} = await loadFixture(prepareFixture);

            expect(await smartWallet.isInitialized(), 'Contract already initialized').to.be.false;

            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000);
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;   

            await expect(
                smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000),
                'Second initialization not rejected'
            ).to.be.revertedWith('already initialized');

        });

        it('Should create the domainSeparator', async function () {
            const  {smartWallet, owner, worker} = await loadFixture(prepareFixture);

            expect(await smartWallet.isInitialized(), 'Contract already initialized').to.be.false;

            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000);        

            expect(await smartWallet.domainSeparator()).to.be.properHex(64);
        });
    });

    describe('Function verify()', function(){
        const HARDHAT_CHAIN_ID = 31337;
        const FAKE_PRIVATE_KEY = 'da1294b386f1c04cd3276ef3298ef122f226472a55f241d22f924bdc19f92379';

        let fakeToken: FakeContract;
        let smartWallet: SmartWallet;
        let privateKey: Buffer;
        let worker: SignerWithAddress;
        let externalWallet: Wallet;

        async function prepareFixture(){
            const smartWalletFactory =await hardhat.getContractFactory('SmartWallet');
            const smartWallet = await smartWalletFactory.deploy();
            const [, worker, utilSigner] = await hardhat.getSigners();

            const provider = hardhat.getDefaultProvider();
            externalWallet =  hardhat.Wallet.createRandom();
            externalWallet.connect(provider);

            privateKey = Buffer.from(externalWallet.privateKey.substring(2, 66), 'hex');
        
            return {smartWallet, worker, utilSigner};
        }

        beforeEach(async function(){            
            ({smartWallet, worker} = await loadFixture(prepareFixture));

            fakeToken = await smock.fake('ERC20');
            fakeToken.transfer.returns(true);

            await smartWallet.initialize(externalWallet.address, fakeToken.address, worker.address, 10, 400000);
        });

        it('Should verify a valid transaction', async function(){
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;

            const relayRequest = createRequest({
                from: externalWallet.address,
                tokenContract: fakeToken.address
            },{});

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                smartWallet.verify(suffixData, relayRequest.request, signature),
                "Verification failed"
            ).not.to.be.rejected;
        });

        it('Should fail when not called by the owner', async function(){
            const {smartWallet, worker, utilSigner: notTheOwner} = await loadFixture(prepareFixture);

            const wallet = hardhat.Wallet.createRandom();
            const provider = hardhat.getDefaultProvider();
            wallet.connect(provider);

            await smartWallet.initialize(wallet.address, fakeToken.address, worker.address, 10, 400000);
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;

            const relayRequest = createRequest({
                from: notTheOwner.address,
                tokenContract: fakeToken.address
            },{});

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                smartWallet.verify(suffixData, relayRequest.request, signature),
                'The verification was not rejected'
            ).to.be.revertedWith('Not the owner of the SmartWallet');
        });

        it('Should fail when the nonce is incorrect', async function(){
            const {smartWallet, worker} = await loadFixture(prepareFixture);

            const wallet = hardhat.Wallet.createRandom();
            const provider = hardhat.getDefaultProvider();
            wallet.connect(provider);

            await smartWallet.initialize(wallet.address, fakeToken.address, worker.address, 10, 400000);
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;

            const relayRequest = createRequest({
                from: wallet.address,
                nonce: '1',
                tokenContract: fakeToken.address
            },{});

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                smartWallet.verify(suffixData, relayRequest.request, signature),
                "Verification failed"
            ).to.be.revertedWith('nonce mismatch');
        });

        it('Should fail when the signature is incorrect', async function(){
            const {smartWallet, worker} = await loadFixture(prepareFixture);

            const wallet = hardhat.Wallet.createRandom();
            const provider = hardhat.getDefaultProvider();
            wallet.connect(provider);

            await smartWallet.initialize(wallet.address, fakeToken.address, worker.address, 10, 400000);
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;

            const relayRequest = createRequest({
                from: wallet.address,
                tokenContract: fakeToken.address
            },{});

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);

            const fakePrivateKey = Buffer.from(FAKE_PRIVATE_KEY, 'hex');

            const signature = getLocalEip712Signature(typedRequestData, fakePrivateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                smartWallet.verify(suffixData, relayRequest.request, signature),
                'Verification failed'
            ).to.be.revertedWith('Signature mismatch');
        });
    });

    describe('Function execute()', function(){
        const HARDHAT_CHAIN_ID = 31337;

        let fakeToken: FakeContract;
        let recipient: FakeContract;
        let smartWallet: SmartWallet;
        let privateKey: Buffer;
        let worker: SignerWithAddress;
        let externalWallet: Wallet;
        let relayHub: SignerWithAddress;
        let recipientFunction: string;
        let provider: BaseProvider;

        async function prepareFixture(){
            const smartWalletFactory = await hardhat.getContractFactory('SmartWallet');
            smartWallet = await smartWalletFactory.deploy();
            [relayHub, worker] = await hardhat.getSigners();

            provider = hardhat.getDefaultProvider();
            externalWallet =  hardhat.Wallet.createRandom();
            externalWallet.connect(provider);

            const ABI = ['function isInitialized()'];
            const abiInterface = new hardhat.utils.Interface(ABI);
            recipientFunction = abiInterface.encodeFunctionData('isInitialized', []);
        }

        beforeEach(async function(){            
            await loadFixture(prepareFixture);

            privateKey = Buffer.from(externalWallet.privateKey.substring(2, 66), 'hex');

            fakeToken = await smock.fake('ERC20');
            fakeToken.transfer.returns(true);

            recipient = await smock.fake('SmartWallet');
            recipient.isInitialized.returns(true);
            
            await smartWallet.initialize(externalWallet.address, fakeToken.address, worker.address, 0, 0);
        });

        it('Should execute a sponsored transaction', async function(){
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;

            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: externalWallet.address,
                to: recipient.address,
                tokenAmount: '10',
                tokenGas: '40000',
                tokenContract: fakeToken.address,
                data: recipientFunction
            },{
                callForwarder: smartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                smartWallet.execute(suffixData, relayRequest.request, signature),
                'Execution failed'
            ).not.to.be.rejected;

            expect(fakeToken.transfer, 'Token.transfer() was not called').to.be.called;
            expect(recipient.isInitialized, 'Recipient method was not called').to.be.called;
        });

        it('Should execute a not sponsored transaction', async function(){
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;

            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: externalWallet.address,
                to: recipient.address,
                tokenAmount: '0',
                tokenGas: '0',
                tokenContract: fakeToken.address,
                data: recipientFunction
            },{
                callForwarder: smartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                smartWallet.execute(suffixData, relayRequest.request, signature),
                'Execution failed'
            ).not.to.be.rejected;

            expect(fakeToken.transfer, 'Token.transfer was called').not.to.be.called;
            expect(recipient.isInitialized, 'Recipient method was not called').to.be.called;
        });

        it('Should increment nonce', async function(){
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;

            const initialNonce = 0;

            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: externalWallet.address,
                to: recipient.address,
                tokenAmount: '10',
                tokenGas: '40000',
                tokenContract: fakeToken.address,
                data: recipientFunction,
                nonce: initialNonce.toString()
            },{
                callForwarder: smartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                smartWallet.execute(suffixData, relayRequest.request, signature),
                'Execution failed'
            ).not.to.be.rejected;

            expect(await smartWallet.nonce(), 'Nonce was not incremented').to.equal(initialNonce+1);
        });

        it('Should fail if not called by the relayHub', async function(){
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;

            const notTheRelayHub =  hardhat.Wallet.createRandom();
            notTheRelayHub.connect(provider);

            const relayRequest = createRequest({
                relayHub: notTheRelayHub.address,
                from: externalWallet.address,
                to: recipient.address,
                tokenAmount: '10',
                tokenGas: '40000',
                tokenContract: fakeToken.address,
                data: recipientFunction
            },{
                callForwarder: smartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                smartWallet.execute(suffixData, relayRequest.request, signature),
                'The execution did not fail'
            ).to.be.rejectedWith('Invalid caller');
        });

        it('Should fail when gas is not enough', async function(){
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;

            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: externalWallet.address,
                to: recipient.address,
                tokenAmount: '10',
                gas: '10000000000',
                tokenContract: fakeToken.address,
                data: recipientFunction
            },{
                callForwarder: smartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                smartWallet.execute(suffixData, relayRequest.request, signature),
                'Execution should fail'
            ).to.be.rejectedWith('Not enough gas left');
        });
    });
});
