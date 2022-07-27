import { expect, use } from 'chai';
import Collector from '../build/contracts/Collector.json';
import TestToken from '../build/contracts/TestToken.json';
import { deployContract, loadFixture, MockProvider, solidity } from 'ethereum-waffle';
import { BaseContract } from '@ethersproject/contracts';
import { Wallet } from '@ethersproject/wallet';

use(solidity);

const buildPartners = (
    wallets: Wallet[],
    share1?: number,
    share2?: number,
    share3?: number,
    share4?: number
) => {
    const [owner, remainder, partner1, partner2, partner3, partner4] = wallets;

    return [
        {
            beneficiary: partner1.getAddress(),
            share: share1 ?? 20
        },
        {
            beneficiary: partner2.getAddress(),
            share: share2 ?? 35
        },
        {
            beneficiary: partner3.getAddress(),
            share: share3 ?? 13
        },
        {
            beneficiary: partner4.getAddress(),
            share: share4 ?? 32
        }
    ];
};

async function deployCollector(
    wallets: Wallet[],
    testToken: BaseContract,
    partners: any
) {
    const [ownerWallet, remainderWallet] = wallets;

    const collector = await deployContract(ownerWallet, Collector, [
        ownerWallet.address,
        testToken.address,
        partners,
        remainderWallet.address
    ]);

    return { collector };
}
describe('Collector', function () {
    async function deployTokenFixture(wallets) {
        const testToken = await deployContract(wallets[0], TestToken);
        return { testToken, wallets };
    }

    async function deployCollectorFixture(wallets: Wallet[]) {
        const partners = buildPartners(wallets);
        const testToken = await deployContract(wallets[0], TestToken);
        const { collector } = await deployCollector(
            wallets,
            testToken,
            partners
        );
        return { collector, testToken, partners };
    }

    describe('deployment', function () {
        it('Should deploy with owner, token and revenue partners', async function () {
            this.timeout(4000);
            const { testToken, wallets } = await loadFixture(
                deployTokenFixture
            );
            const partners = buildPartners(wallets);
            const { collector } = await deployCollector(
                wallets,
                testToken,
                partners
            );
            expect(collector);
        });

        it('Should not let deploy with invalid shares', async function () {
            const { testToken, wallets } = await loadFixture(
                deployTokenFixture
            );
            const partners = buildPartners(wallets, 25, 25, 25, 26);
            await expect(
                deployCollector(wallets, testToken, partners)
            ).to.be.revertedWith('total shares must add up to 100%');
        });
    });

    describe('withdraw', function () {
        it('Should Withdraw', async function () {
            const { collector, testToken, partners } = await loadFixture(
                deployCollectorFixture
            );
            await testToken.mint(100, collector.address);
            await collector.withdraw();
            const partnerBalance = await testToken.balanceOf(
                partners[0].beneficiary
            );
            expect(partnerBalance.toNumber()).to.be.greaterThan(0);
        });

        it('Should fail when no revenue to share', async function () {
            const { collector } = await loadFixture(deployCollectorFixture);
            await expect(collector.withdraw()).to.be.revertedWith(
                'no revenue to share'
            );
        });
    });

    describe('updateShares', function () {
        it('Should update shares and partners when token balance is zero', async function () {
            const { collector } = await loadFixture(
                deployCollectorFixture
            );

            const newWallets = new MockProvider().getWallets();
            const newPartners = buildPartners(newWallets, 20, 30, 10, 40);

            await collector.updateShares(newPartners);
            expect('updateShares').to.be.calledOnContract(collector);
        });

        it('Should update shares and partners when token balance is a remainder amount', async function () {
            const { collector, testToken } = await loadFixture(
                deployCollectorFixture
            );
            await testToken.mint(999, collector.address);
            await collector.withdraw();

            const newWallets = new MockProvider().getWallets();
            const newPartners = buildPartners(newWallets);

            await collector.updateShares(newPartners);
            expect('updateShares').to.be.calledOnContract(collector);
        });

        it('Should fail when token balance is not a remainder', async function () {
            const { collector, testToken } = await loadFixture(
                deployCollectorFixture
            );
            await testToken.mint(100, collector.address);

            const newWallets = new MockProvider().getWallets();
            const newPartners = buildPartners(newWallets);

            await expect(collector.updateShares(newPartners)).to.be.revertedWith(
                'balance is not a remainder'
            );
        });
    });

    describe('updateRemainderAddress', function () {
        it('Should update remainder address when token balance is zero or remainder', async function () {
            const { collector } = await loadFixture(
                deployCollectorFixture
            );

            const [ newRemainderWallet ] = new MockProvider().getWallets();

            await collector.updateRemainderAddress(newRemainderWallet.address);
            expect('updateRemainderAddress').to.be.calledOnContract(collector);
        });

        it('Should fail when token balance is not a remainder', async function () {
            const { collector, testToken } = await loadFixture(
                deployCollectorFixture
            );
            await testToken.mint(100, collector.address);
            const [ newRemainderWallet ] = new MockProvider().getWallets();

            await expect(collector.updateRemainderAddress(newRemainderWallet.address)).to.be.revertedWith(
                'balance is not a remainder'
            );
        });
    });
});
