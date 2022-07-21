import { expect, use } from 'chai';
import Collector from '../build/Collector.json';
import TestToken from '../build/TestToken.json';
import { deployContract, MockProvider, solidity } from 'ethereum-waffle';

use(solidity);

describe('Collector', function () {
    async function deployCollector(
        share1?: number,
        share2?: number,
        share3?: number,
        share4?: number
    ) {
        const [owner, partner1, partner2, partner3, partner4] =
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

        const testToken = await deployContract(owner, TestToken);
        const collector = await deployContract(owner, Collector, [
            owner.address,
            testToken.address,
            partners
        ]);

        return { collector, testToken, partners, owner };
    }

    describe('Deployment', function () {
        it('Should deploy with owner, token and revenue partners', async function () {
            const { collector } = await deployCollector();
            expect(collector.address).to.be.properAddress;
        });

        it('Should not let deploy with invalid shares', async function () {
            await expect(deployCollector(25, 25, 25, 26)).to.be.revertedWith(
                'total shares must add up to 100%'
            );
        });
    });

    describe('Withdraw', function () {
        it('Should Withdraw', async function () {
            const { collector, testToken, partners } =
                await deployCollector();
            await testToken.mint(100, collector.address);

            await collector.withdraw();
            expect(partners[0].share).to.equal(
                await testToken.balanceOf(partners[0].beneficiary)
            );
        });

        it('Should fail when no revenue to share', async function () {
            const { collector } = await deployCollector();
            await expect(collector.withdraw()).to.be.revertedWith(
                'no revenue to share'
            );
        });
    });

    describe('updateShares', function () {
        it('Should update shares and partners when token balance is zero', async function () {
            const { collector, partners } = await deployCollector();
            await collector.updateShares(partners);
            expect('updateShares').to.be.calledOnContract(collector);
        });

        it('Should update shares and partners after withdrawing irregular amount', async function () {
            //this is the important test. After modifying the contract, this should pass
            const { collector, testToken, partners } = await deployCollector();
            await testToken.mint(999, collector.address);
            await collector.withdraw();
            await collector.updateShares(partners);
            expect(partners[0].share).to.equal(
                await testToken.balanceOf(partners[0].beneficiary)
            );
        });

        it('Should fail when token balance is higher than zero', async function () {
            const { collector, testToken, partners } =
                await deployCollector();
            await testToken.mint(100, collector.address);
            await expect(collector.updateShares(partners)).to.be.revertedWith(
                "can't update with balance > 0"
            );
        });
    });
});
