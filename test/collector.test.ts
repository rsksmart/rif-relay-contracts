import { expect, use } from 'chai';
import Collector from '../build/contracts/Collector.json';
import TestToken from '../build/contracts/TestToken.json';
import {
    deployContract,
    loadFixture,
    MockProvider,
    solidity
} from 'ethereum-waffle';
import { Wallet } from '@ethersproject/wallet';

use(solidity);

const PARTNER_SHARES = [20, 30, 40, 10];
const NUMBER_OF_PARTNERS = PARTNER_SHARES.length;

type Partner = {
    beneficiary: string;
    share: number;
};

async function buildPartners(partnerWallets: Wallet[], shares: number[]) {
    return await Promise.all(
        partnerWallets.map(async (wallet, index) => {
            const partner: Partner = {
                beneficiary: await wallet.getAddress(),
                share: shares[index]
            };
            return partner;
        })
    );
}

async function prepareAllFixture(wallets: Wallet[]) {
    const [
        owner,
        remainder,
        partner1,
        partner2,
        partner3,
        partner4,
        utilWallet
    ] = wallets;

    const testToken = await deployContract(owner, TestToken);
    const partners = await buildPartners(
        [partner1, partner2, partner3, partner4],
        PARTNER_SHARES
    );

    const collector = await deployContract(owner, Collector, [
        owner.address,
        testToken.address,
        partners,
        remainder.address
    ]);

    return { collector, testToken, partners, remainder, utilWallet };
}

describe('Collector', () => {
    describe('deployment', () => {
        it('Should deploy with owner, token and revenue partners', async () => {
            const { collector } = await loadFixture(prepareAllFixture);
            expect(collector);
        });

        it('Should not let deploy with invalid shares', async () => {
            const [owner, remainder, partner1, partner2, partner3, partner4] =
                new MockProvider().getWallets();

            const testToken = await deployContract(owner, TestToken);

            const partners = await buildPartners(
                [partner1, partner2, partner3, partner4],
                [25, 25, 25, 26]
            );

            await expect(
                deployContract(owner, Collector, [
                    owner.address,
                    testToken.address,
                    partners,
                    remainder.address
                ])
            ).to.be.revertedWith('Total shares must add up to 100%');
        });

        it('Should not let deploy if the array of partners is empty', async () => {
            const [owner, remainder] = new MockProvider().getWallets();

            const testToken = await deployContract(owner, TestToken);

            const partners: Wallet[] = [];

            await expect(
                deployContract(owner, Collector, [
                    owner.address,
                    testToken.address,
                    partners,
                    remainder.address
                ])
            ).to.be.revertedWith('Total shares must add up to 100%');
        });

        it('Should not let deploy if a share is 0', async () => {
            const [owner, remainder, partner1, partner2, partner3, partner4] =
                new MockProvider().getWallets();

            const testToken = await deployContract(owner, TestToken);

            const partners = await buildPartners(
                [partner1, partner2, partner3, partner4],
                [30, 30, 0, 40]
            );

            await expect(
                deployContract(owner, Collector, [
                    owner.address,
                    testToken.address,
                    partners,
                    remainder.address
                ])
            ).to.be.revertedWith('0 is not a valid share');
        });
    });

    describe('updateShares', () => {
        it('Should update shares and partners when token balance is zero', async () => {
            const { collector } = await loadFixture(prepareAllFixture);
            const newPartners = await buildPartners(
                new MockProvider().getWallets().slice(0, NUMBER_OF_PARTNERS),
                PARTNER_SHARES
            );

            await collector.updateShares(newPartners);
            expect('updateShares').to.be.calledOnContract(collector);
        });

        it('Should update shares and partners when token balance is a remainder amount', async () => {
            const { collector, testToken } = await loadFixture(
                prepareAllFixture
            );

            await testToken.mint(3, collector.address);

            const newPartners = await buildPartners(
                new MockProvider().getWallets().slice(0, NUMBER_OF_PARTNERS),
                PARTNER_SHARES
            );

            await collector.updateShares(newPartners);
            expect('updateShares').to.be.calledOnContract(collector);
        });

        it('Should fail when token balance is grater than a remainder', async () => {
            const { collector, testToken } = await loadFixture(
                prepareAllFixture
            );

            await testToken.mint(100, collector.address);
            const newPartners = await buildPartners(
                new MockProvider().getWallets().slice(0, NUMBER_OF_PARTNERS),
                PARTNER_SHARES
            );

            await expect(
                collector.updateShares(newPartners)
            ).to.be.revertedWith('There is balance to share');
        });

        it('Should fail when is called by an address that is not the owner', async () => {
            const { collector, utilWallet } = await loadFixture(
                prepareAllFixture
            );
            const externallyLinkedCollector = collector.connect(
                utilWallet.address
            );
            const newPartners = await buildPartners(
                new MockProvider().getWallets().slice(0, NUMBER_OF_PARTNERS),
                PARTNER_SHARES
            );

            await expect(
                externallyLinkedCollector.updateShares(newPartners)
            ).to.be.revertedWith('Only owner can call this');
        });

        it('Should fail if the shares does not sum up to 100', async () => {
            const { collector } = await loadFixture(prepareAllFixture);

            const newPartners = await buildPartners(
                new MockProvider().getWallets().slice(0, NUMBER_OF_PARTNERS),
                [25, 25, 24, 25]
            );

            await expect(
                collector.updateShares(newPartners)
            ).to.be.revertedWith('Total shares must add up to 100%');
        });

        it('Should fail if a share is 0', async () => {
            const { collector } = await loadFixture(prepareAllFixture);

            const newPartners = await buildPartners(
                new MockProvider().getWallets().slice(0, NUMBER_OF_PARTNERS),
                [50, 25, 25, 0]
            );

            await expect(
                collector.updateShares(newPartners)
            ).to.be.revertedWith('0 is not a valid share');
        });
    });

    describe('updateRemainderAddress', () => {
        it('Should update remainder address when token balance is zero', async () => {
            const { collector, utilWallet } = await loadFixture(
                prepareAllFixture
            );

            await collector.updateRemainderAddress(utilWallet.address);
            expect('updateRemainderAddress').to.be.calledOnContract(collector);
        });

        it('Should update remainder when token balance is a remainder and should withdraw remainder', async () => {
            const { collector, testToken, remainder, utilWallet } =
                await loadFixture(prepareAllFixture);
            await testToken.mint(2, collector.address);

            await collector.updateRemainderAddress(utilWallet.address);

            expect(
                await testToken.balanceOf(collector.address),
                'The balance of collector'
            ).to.equal(0);
            expect(
                await testToken.balanceOf(remainder.address),
                'The balance of remainder'
            ).to.equal(2);
        });

        it('Should withdraw when the remainders address sent is the same as the current one', async () => {
            const { collector, testToken, remainder } = await loadFixture(
                prepareAllFixture
            );

            await testToken.mint(3, collector.address);

            await collector.updateRemainderAddress(remainder.address);

            expect(
                await testToken.balanceOf(collector.address),
                'The balance of collector'
            ).to.equal(0);
            expect(
                await testToken.balanceOf(remainder.address),
                'The balance of remainder'
            ).to.equal(3);
        });

        it('Should fail when token balance > = remainder', async () => {
            const { collector, testToken, utilWallet } = await loadFixture(
                prepareAllFixture
            );

            await testToken.mint(4, collector.address);

            await expect(
                collector.updateRemainderAddress(utilWallet.address)
            ).to.be.revertedWith('There is balance to share');
        });

        it('Should fail when is called by an address that is not the owner', async () => {
            const { collector, utilWallet } = await loadFixture(
                prepareAllFixture
            );
            const externallyLinkedCollector = collector.connect(
                utilWallet.address
            );

            await expect(
                externallyLinkedCollector.updateRemainderAddress(
                    utilWallet.address
                )
            ).to.be.revertedWith('Only owner can call this');
        });
    });

    describe('getBalance', () => {
        it('Should return 0 if the contract has been just deployed', async () => {
            const { collector } = await loadFixture(prepareAllFixture);

            await expect(await collector.getBalance()).to.equal(0);
        });

        it('Should return 100 after that value has been minted', async () => {
            const { collector, testToken } = await loadFixture(
                prepareAllFixture
            );

            await testToken.mint(100, collector.address);

            await expect(await collector.getBalance()).to.equal(100);
        });
    });

    describe('withdraw', () => {
        it('Should withdraw', async () => {
            const { collector, testToken, partners } = await loadFixture(
                prepareAllFixture
            );

            await testToken.mint(100, collector.address);
            await collector.withdraw();
            expect(
                await testToken.balanceOf(partners[0].beneficiary),
                'Partner[0] balance'
            ).to.equal(PARTNER_SHARES[0]);

            expect(
                await testToken.balanceOf(partners[1].beneficiary),
                'Partner[1] balance'
            ).to.equal(PARTNER_SHARES[1]);

            expect(
                await testToken.balanceOf(partners[2].beneficiary),
                'Partner[2] balance'
            ).to.equal(PARTNER_SHARES[2]);

            expect(
                await testToken.balanceOf(partners[3].beneficiary),
                'Partner[3] balance'
            ).to.equal(PARTNER_SHARES[3]);

            expect(
                await testToken.balanceOf(collector.address),
                'Balance of the collector'
            ).to.equal(0);
        });

        it('Should fail when no revenue to share', async () => {
            const { collector, testToken } = await loadFixture(
                prepareAllFixture
            );

            await testToken.mint(1, collector.address);
            await expect(collector.withdraw()).to.be.revertedWith(
                'Not enough balance to split'
            );
        });

        it('Should fail when is called by an address that is not the owner', async () => {
            const { collector, utilWallet } = await loadFixture(
                prepareAllFixture
            );
            const externallyLinkedCollector = collector.connect(
                utilWallet.address
            );

            await expect(
                externallyLinkedCollector.withdraw()
            ).to.be.revertedWith('Only owner can call this');
        });
    });

    describe('transferOwnership', () => {
        it('Should transfer ownership', async () => {
            const { collector, utilWallet } = await loadFixture(
                prepareAllFixture
            );

            await collector.transferOwnership(utilWallet.address);

            expect(await collector.owner()).to.be.equal(utilWallet.address);
        });

        it('Should fail when is called by an address that is not the owner', async () => {
            const { collector, utilWallet } = await loadFixture(
                prepareAllFixture
            );
            const externallyLinkedCollector = collector.connect(
                utilWallet.address
            );

            await expect(
                externallyLinkedCollector.transferOwnership(utilWallet.address)
            ).to.be.revertedWith('Only owner can call this');
        });
    });
});
