import { expect, use } from 'chai';
import Collector from '../build/Collector.json';
import BurnableTestToken from '../build/BurnableTestToken.json';
import { deployContract, MockProvider, solidity } from 'ethereum-waffle';

use(solidity);

describe('Collector', function () {
    async function deployCollector(
        share1?: number,
        share2?: number,
        share3?: number,
        share4?: number
    ) {
        const [owner, partner1, partner2, partner3, partner4, dummyWallet] =
            new MockProvider().getWallets();
        const partners = [
            {
                beneficiary: await partner1.getAddress(),
                share: share1 ?? 20
            },
            {
                beneficiary: await partner2.getAddress(),
                share: share2 ?? 35
            },
            {
                beneficiary: await partner3.getAddress(),
                share: share3 ?? 13
            },
            {
                beneficiary: await partner4.getAddress(),
                share: share4 ?? 32
            }
        ];

        const testToken = await deployContract(owner, BurnableTestToken);
        const collector = await deployContract(owner, Collector, [
            owner.address,
            testToken.address,
            partners
        ]);

        return { collector, testToken, partners, owner, dummyWallet };
    }

    describe('Deployment', async () => {
        it('Should deploy with owner, token and revenue partners', async () => {
            const { collector } = await deployCollector();
            expect(collector.address).to.be.properAddress;
        });

        it('Should not let deploy with invalid shares', async function () {
            await expect(deployCollector(25, 25, 25, 26)).to.be.revertedWith(
                'total shares must add up to 100%'
            );
        });

        it('Should not let deploy if the array of partners is empty', async function () {
            const [owner] = new MockProvider().getWallets();
            const partners = [];
            const testToken = await deployContract(owner, BurnableTestToken);
            await expect(
                deployContract(owner, Collector, [
                    owner.address,
                    testToken.address,
                    partners
                ])
            ).to.be.revertedWith('total shares must add up to 100%');
        });
    });

    describe('updateShares', async () => {
        it('Should update shares and partners when token balance is zero', async function () {
            const { collector, partners } = await deployCollector();
            await collector.updateShares(partners);
            expect('updateShares').to.be.calledOnContract(collector);
        });

        it('Should update shares and partners after withdrawing irregular amount', async function () {
            const { collector, testToken, partners } = await deployCollector();
            await testToken.mint(999, collector.address);
            await collector.withdraw();
            await collector.updateShares(partners);
            expect('updateShares').to.be.calledOnContract(collector);
        });

        it('Should fail when token balance is higher than zero', async function () {
            const { collector, testToken, partners } = await deployCollector();
            await testToken.mint(100, collector.address);
            await expect(collector.updateShares(partners)).to.be.revertedWith(
                "can't update with balance > 0"
            );
        });

        it('Should fail if not called by the owner', async () => {
            const { collector, partners, dummyWallet } =
                await deployCollector();
            const externallyLinkedCollector = collector.connect(
                dummyWallet.address
            );
            await expect(
                externallyLinkedCollector.updateShares(partners)
            ).to.be.revertedWith('can only call from owner');
        });
    });

    describe('Withdraw', async () => {
        it('Should Withdraw', async () => {
            const { collector, testToken, partners } = await deployCollector();
            await testToken.mint(100, collector.address);

            await collector.withdraw();
            expect(partners[0].share).to.equal(
                await testToken.balanceOf(partners[0].beneficiary)
            );
        });

        it('Should fail when no revenue to share', async () => {
            const { collector } = await deployCollector();
            await expect(collector.withdraw()).to.be.revertedWith(
                'no revenue to share'
            );
        });

        it('Should fail if not called by the owner', async () => {
            const { collector, dummyWallet } = await deployCollector();
            const externallyLinkedCollector = collector.connect(
                dummyWallet.address
            );
            await expect(
                externallyLinkedCollector.withdraw()
            ).to.be.revertedWith('can only call from owner');
        });
    });

    describe('getBalance', async () => {
        it('Should return 0 if the contract has been just deployed', async () => {
            const { collector } = await deployCollector();
            await expect(await collector.getBalance()).to.equal(0);
        });

        it('Should return 100 after that value has been minted', async () => {
            const { collector, testToken } = await deployCollector();
            await testToken.mint(100, collector.address);
            await expect(await collector.getBalance()).to.equal(100);
        });
    });

    describe('transferOwnership', async () => {
        it('Should transfer ownership', async () => {
            const { collector } = await deployCollector();
            const newOwner = new MockProvider().createEmptyWallet();
            await collector.transferOwnership(newOwner.address);
            const currentOwner = await collector.owner();
            expect(currentOwner).to.be.equal(newOwner.address);
        });

        it('Should fail if not called by the owner', async () => {
            const { collector, dummyWallet } = await deployCollector();
            const externallyLinkedCollector = collector.connect(
                dummyWallet.address
            );
            const newOwner = new MockProvider().createEmptyWallet();
            await expect(
                externallyLinkedCollector.transferOwnership(newOwner.address)
            ).to.be.revertedWith('can only call from owner');
        });
    });
});
