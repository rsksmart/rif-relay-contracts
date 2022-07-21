import { expect, use } from 'chai';
import Collector from '../build/Collector.json';
import TestToken from '../build/TestToken.json';
import { deployContract, MockProvider, solidity } from 'ethereum-waffle';

use(solidity);

describe('Collector', function () {
  async function deployCollector(share1?: number, share2?: number, share3?: number, share4?: number) {
    const [owner, partner1, partner2, partner3, partner4] = new MockProvider().getWallets();
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
      },
    ];

    const testToken = await deployContract(owner, TestToken);
    const collector = await deployContract(owner, Collector, [ owner.address, testToken.address, partners ]);

    return { collector, testToken, partners, owner };
  }

  describe('Deployment', function () {
    it('Should deploy with owner, token and revenue partners', async function () {
      const { collector, owner } = await deployCollector();
      const collectorBalance = (await collector.getBalance());
      console.log(collectorBalance);
      expect(collectorBalance).to.equal(0);
      expect(await collector.owner()).to.equal(await owner.getAddress());
    });

    it('Should not let deploy with invalid shares', async function () {
      await expect(deployCollector(1,2,3,4)).to.be.revertedWith('total shares must add up to 100%');
    });
  });

  describe.skip('Withdraw', function () {
    it.skip('Should Withdraw', async function () {
      const { collector, owner, testToken, partners } = await deployCollector();
      await testToken.mint(100, collector.address);

      await collector.withdraw();
      expect(partners[0].share).to.equal(await testToken.balanceOf(partners[0].beneficiary));
    });

    it.skip('Should fail when no revenue to share', async function () {
      const { collector, owner, testToken, partners } = await deployCollector();
      await expect(collector.withdraw()).to.be.revertedWith('no revenue to share');
    });
  });

  describe.skip('updateShares', function () {
    it.skip('Should update shares and partners when token balance is zero', async function () {
      const { collector, owner, testToken, partners } = await deployCollector();
      await collector.updateShares(partners);
      expect(partners[0].share).to.equal(await testToken.balanceOf(partners[0].beneficiary));
    });

    it.skip('Should update shares and partners after withdraw', async function () {
      const { collector, owner, testToken, partners } = await deployCollector();
      await testToken.mint(100, collector.address);
      await collector.withdraw();
      await collector.updateShares(partners);
      expect(partners[0].share).to.equal(await testToken.balanceOf(partners[0].beneficiary));
    });

    it.skip('Should fail when token balance is higher than zero', async function () {
      const { collector, owner, testToken, partners } = await deployCollector();
      await testToken.mint(100, collector.address);
      await expect(collector.updateShares(partners)).to.be.revertedWith("can't update with balance > 0");
    });
  });
});
