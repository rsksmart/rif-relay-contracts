import { MockContract, smock } from '@defi-wonderland/smock';
import { SmartWallet, SmartWallet__factory } from 'typechain-types';
import chai, { expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {ethers as hardhat} from 'hardhat';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = hardhat.constants.AddressZero;

describe('SmartWallet template', function(){
    describe('Function initialize()', function() {
        let smartWalletMock: MockContract<SmartWallet>;

        beforeEach(async function(){
            const smartWalletFactoryMock = 
                await smock.mock<SmartWallet__factory>('CustomSmartWallet');
        
            smartWalletMock = await smartWalletFactoryMock.deploy();
        });

        it('Should be initialized during the deployment', async function(){
            expect(await smartWalletMock.isInitialized()).to.be.true;
        });

        it('Should fail to initialize if alredy initialized', async function(){
            const[owner] = await hardhat.getSigners();
            await expect(smartWalletMock.initialize(
                owner.address,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                '0',
                '50000',
                '0x'
            )).to.be.rejectedWith('already initialized');
        });
    });
});
