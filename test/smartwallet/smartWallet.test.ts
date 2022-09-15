import { ethers } from 'hardhat';
import chai, { expect} from 'chai';
import { FakeContract, /*MockContract,*/ smock } from '@defi-wonderland/smock';
import chaiAsPromised from 'chai-as-promised';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { EnvelopingTypes } from 'typechain-types/contracts/RelayHub';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

type RelayRequest = EnvelopingTypes.RelayRequestStruct;
// type FordwardRequest = IForwarder.ForwardRequestStruct;
// type RelayData = EnvelopingTypes.RelayDataStruct;

const ZERO_ADDRESS = ethers.constants.AddressZero ;

describe('SmartWallet', function(){
    describe('Function initialize()', function(){
        let fakeToken:FakeContract;

        async function prepareFixture(){
            const smartWalletFactory =await ethers.getContractFactory('SmartWallet');
            const smartWallet = await smartWalletFactory.deploy();
            const [owner, worker, utilSigner] = await ethers.getSigners();
        
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

        afterEach(function(){
            fakeToken = undefined as unknown as FakeContract;
        });
    });

    describe('Function verify()', function(){
        async function prepareFixture(){
            const smartWalletFactory =await ethers.getContractFactory('SmartWallet');
            const smartWallet = await smartWalletFactory.deploy();
            const [owner, worker, utilSigner] = await ethers.getSigners();
        
            return {smartWallet, owner, worker, utilSigner};
        }

        function createRequest(): RelayRequest {
            return {
                request: {
                    relayHub: ZERO_ADDRESS,
                    from: ZERO_ADDRESS,
                    to: ZERO_ADDRESS,
                    tokenContract: ZERO_ADDRESS,
                    value: '0',
                    gas: '1000000',
                    nonce: '0',
                    tokenAmount: '1',
                    tokenGas: '50000',
                    data: '0X'
                },
                relayData: {
                    gasPrice:'0',
                    relayWorker: ZERO_ADDRESS,
                    callForwarder: ZERO_ADDRESS,
                    callVerifier: ZERO_ADDRESS
                }
            } as RelayRequest
        }

        it.skip('Should fail if not called by the owner', async function(){
            const {owner} = await loadFixture(prepareFixture);
            const request = createRequest();
            console.log('smartWallet.test181');
            // const signer = new ethers.Wallet(owner.);
            console.log('smartWallet.test183');
            const domain = {
                name: "name",
                version: "1.0.0",
                chainId: 33,
                verifyingContract: ""              
            };

            const types = {
                request: [
                    {name: 'relayHub', type: 'string'},
                    {name: 'from', type: 'string'},
                    {name: 'to', type: 'string'},
                    {name: 'tokenContract', type: 'string'},
                    {name: 'value', type: 'string'},
                    {name: 'gas', type: 'string'},
                    {name: 'nonce', type: 'string'},
                    {name: 'tokenAmount', type: 'string'},
                    {name: 'tokenGas', type: 'string'},
                    {name: 'data', type: 'string'}

                ],
                relayData: [
                    {name: 'gasPrice', type: 'string'},
                    {name: 'relayWorker', type: 'string'},
                    {name: 'callForwarder', type: 'string'},
                    {name: 'callVerifier', type: 'string'}
                ]
            };

            console.log('smartWallet.test209');
            const signature = await owner._signTypedData(domain, types, request);

            console.log('smartWallet.test212');
            console.log('Signature: ', signature);

            // smartwallet.verify(, request, signature);
        });
    });
});
