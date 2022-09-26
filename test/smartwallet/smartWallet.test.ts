import { ethers as hardhat } from 'hardhat';
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

            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000);
            expect(await smartWallet.isInitialized(), 'Contract not initialized').to.be.true;            
        });

        it('Should call transfer on not sponsored deployment', async function(){
            const {smartWallet, owner, worker} = await loadFixture(prepareFixture);

            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000);
            expect(fakeToken.transfer).to.be.called;
        });

        it('Should not call transfer on sponsored deployment', async function(){
            const {smartWallet, utilSigner, worker} = await loadFixture(prepareFixture);

            await smartWallet.initialize(utilSigner.address, fakeToken.address, worker.address, 0, 0);

            expect(fakeToken.transfer).not.to.be.called;
        });

        it('Should fail to initialize a contract when it is already initialized', async function(){
            const {smartWallet, owner, worker} = await loadFixture(prepareFixture);

            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000);  

            await expect(
                smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000),
                'Second initialization not rejected'
            ).to.be.revertedWith('already initialized');
        });

        it('Should create the domainSeparator', async function () {
            const  {smartWallet, owner, worker} = await loadFixture(prepareFixture);

            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000);        

            expect(await smartWallet.domainSeparator()).to.be.properHex(64);
        });

        it('Should fail when the token transfer method fails', async function () {
            const  {smartWallet, owner, worker} = await loadFixture(prepareFixture);

            fakeToken.transfer.returns(false);

            await expect(
                smartWallet.initialize(owner.address, fakeToken.address, worker.address, 10, 400000),
                'Deployment should be reverted'
            ).to.be.revertedWith('Unable to pay for deployment');
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

    describe('Function directExecute()', function(){
        let fakeToken: FakeContract;
        let recipient: FakeContract;
        let smartWallet: SmartWallet;
        let worker: SignerWithAddress;
        let externalWallet: Wallet;
        let owner: SignerWithAddress;
        let recipientFunction: string;
        let provider: BaseProvider;
        let utilWallet: SignerWithAddress;

        async function prepareFixture(){
            const smartWalletFactory = await hardhat.getContractFactory('SmartWallet');
            smartWallet = await smartWalletFactory.deploy();
            [owner, worker, utilWallet] = await hardhat.getSigners();

            const ABI = ['function isInitialized()'];
            const abiInterface = new hardhat.utils.Interface(ABI);
            recipientFunction = abiInterface.encodeFunctionData('isInitialized', []);
        }

        beforeEach(async function(){            
            await loadFixture(prepareFixture);

            recipient = await smock.fake('SmartWallet');
            recipient.isInitialized.returns(true);

            fakeToken = await smock.fake('ERC20');
            fakeToken.transfer.returns(true);
        });

        it('Should execute a valid transaction', async function(){
            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 0, 0);

            await expect(
                smartWallet.directExecute(recipient.address, recipientFunction),
                'Execution failed'
            ).not.to.be.rejected;
        });

        it('Should failed when not called by the owner', async function(){
            provider = hardhat.getDefaultProvider();
            externalWallet =  hardhat.Wallet.createRandom();
            externalWallet.connect(provider);

            await smartWallet.initialize(externalWallet.address, fakeToken.address, worker.address, 0, 0);

            await expect(
                smartWallet.directExecute(recipient.address, recipientFunction),
                'Execution should be rejected'
            ).to.be.rejectedWith('Not the owner of the SmartWallet');
        });

        it('Should send balance back to owner', async function(){
            await smartWallet.initialize(owner.address, fakeToken.address, worker.address, 0, 0);

            provider = hardhat.getDefaultProvider();
            const amountToTransfer = hardhat.utils.parseEther('1000');

            await utilWallet.sendTransaction({
                to: smartWallet.address,
                value: amountToTransfer
            });
            
            const ownerBalanceBefore = await owner.getBalance();

            await expect(
                smartWallet.directExecute(recipient.address, recipientFunction),
                'Execution failed'
            ).not.to.be.rejected;

            const ownerBalanceAfter = await owner.getBalance();
            const difference = Number(hardhat.utils.formatEther(ownerBalanceAfter.sub(ownerBalanceBefore)));
            const amountToTransferAsNumber = Number(hardhat.utils.formatEther(amountToTransfer));

            expect(difference).approximately(amountToTransferAsNumber, 2);
        });
    })
});
