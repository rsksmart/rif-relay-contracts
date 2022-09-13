import { ethers } from 'hardhat';
import chai, { expect} from 'chai';
import { FakeContract, /*MockContract,*/ smock } from '@defi-wonderland/smock';
import chaiAsPromised from 'chai-as-promised';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

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
});
