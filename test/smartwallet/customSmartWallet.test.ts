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
