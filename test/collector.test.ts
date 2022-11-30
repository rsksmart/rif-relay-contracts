import {
  smock,
  FakeContract,
  MockContractFactory,
  MockContract,
} from '@defi-wonderland/smock';
import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
import { ethers as hardhat } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Collector, Collector__factory } from '../typechain-types';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const expect = chai.expect;

const PARTNER_SHARES = [20, 30, 40, 10];
const NUMBER_OF_PARTNERS = PARTNER_SHARES.length;

type Partner = {
  beneficiary: string;
  share: number;
};

async function buildPartners(
  partnerWallets: SignerWithAddress[],
  shares: number[]
) {
  return await Promise.all(
    partnerWallets.map(async (wallet, index) => {
      const partner: Partner = {
        beneficiary: await wallet.getAddress(),
        share: shares[index],
      };

      return partner;
    })
  );
}

describe('Collector', function () {
  let owner: SignerWithAddress;
  let collectorFactory: MockContractFactory<Collector__factory>;
  let fakeToken: FakeContract;
  let partners: Partner[];
  let remainderDestination: SignerWithAddress;
  let partner1: SignerWithAddress;
  let partner2: SignerWithAddress;
  let partner3: SignerWithAddress;
  let partner4: SignerWithAddress;
  let collector: MockContract<Collector>;

  async function deployCollector() {
    partners = await buildPartners(
      [partner1, partner2, partner3, partner4],
      PARTNER_SHARES
    );

    collector = await collectorFactory.deploy(
      owner.address,
      fakeToken.address,
      partners,
      remainderDestination.address
    );
  }

  beforeEach(async function () {
    [owner, partner1, partner2, partner3, partner4, remainderDestination] =
      await hardhat.getSigners();

    fakeToken = await smock.fake('ERC20');
    fakeToken['transfer'].returns(true);

    collectorFactory = await smock.mock<Collector__factory>('Collector');
  });

  describe('constructor()', function () {
    it('Should deploy a Collector', async function () {
      partners = await buildPartners(
        [partner1, partner2, partner3, partner4],
        PARTNER_SHARES
      );

      const collector = await collectorFactory.deploy(
        owner.address,
        fakeToken.address,
        partners,
        remainderDestination.address
      );

      expect(await collector.owner(), 'Failed to set the owner').to.be.a
        .properAddress;
      expect(await collector.token(), 'Failed to set the token').not.to.be.null;
    });

    it('Should not let deploy with invalid shares', async function () {
      const partners = await buildPartners(
        [partner1, partner2, partner3, partner4],
        [25, 25, 25, 26]
      );

      await expect(
        collectorFactory.deploy(
          owner.address,
          fakeToken.address,
          partners,
          remainderDestination.address
        )
      ).to.be.revertedWith('Shares must add up to 100%');
    });

    it('Should not let deploy if the array of partners is empty', async function () {
      const partners: Partner[] = [];

      await expect(
        collectorFactory.deploy(
          owner.address,
          fakeToken.address,
          partners,
          remainderDestination.address
        )
      ).to.be.revertedWith('Shares must add up to 100%');
    });

    it('Should not let deploy if a share is 0', async function () {
      const partners = await buildPartners(
        [partner1, partner2, partner3, partner4],
        [30, 30, 0, 40]
      );

      await expect(
        collectorFactory.deploy(
          owner.address,
          fakeToken.address,
          partners,
          remainderDestination.address
        )
      ).to.be.revertedWith('0 is not a valid share');
    });
  });

  describe('updateShares', function () {
    beforeEach(async function () {
      await deployCollector();
    });

    it('Should update shares and partners when token balance is zero', async function () {
      const [, , , , , , newPartner1, newPartner2, newPartner3, newPartner4] =
        await hardhat.getSigners();

      const newPartners = await buildPartners(
        [newPartner1, newPartner2, newPartner3, newPartner4],
        PARTNER_SHARES
      );

      await collector.updateShares(newPartners);

      expect(collector.updateShares).to.have.been.called;
    });

    it('Should update shares and partners when token balance is a remainder amount', async function () {
      fakeToken.balanceOf.returns(3);

      const [, , , , , , newPartner1, newPartner2, newPartner3, newPartner4] =
        await hardhat.getSigners();

      const newPartners = await buildPartners(
        [newPartner1, newPartner2, newPartner3, newPartner4],
        PARTNER_SHARES
      );

      await collector.updateShares(newPartners);

      expect(collector.updateShares).to.have.been.called;
    });

    it('Should fail when token balance is grater than a remainder', async function () {
      fakeToken.balanceOf.returns(5);

      const [, , , , , , newPartner1, newPartner2, newPartner3, newPartner4] =
        await hardhat.getSigners();

      const newPartners = await buildPartners(
        [newPartner1, newPartner2, newPartner3, newPartner4],
        PARTNER_SHARES
      );

      await expect(collector.updateShares(newPartners)).to.be.revertedWith(
        'There is balance to share'
      );
    });

    it('Should fail when is called by an account different than the owner', async function () {
      const [
        ,
        ,
        ,
        ,
        ,
        ,
        newPartner1,
        newPartner2,
        newPartner3,
        newPartner4,
        notTheOwner,
      ] = await hardhat.getSigners();

      const newPartners = await buildPartners(
        [newPartner1, newPartner2, newPartner3, newPartner4],
        PARTNER_SHARES
      );

      await expect(
        collector.connect(notTheOwner).updateShares(newPartners)
      ).to.be.revertedWith('Only owner can call this');
    });

    it('Should fail if the shares does not sum up to 100', async function () {
      const [, , , , , , newPartner1, newPartner2, newPartner3, newPartner4] =
        await hardhat.getSigners();

      const newPartners = await buildPartners(
        [newPartner1, newPartner2, newPartner3, newPartner4],
        [25, 25, 25, 26]
      );

      await expect(collector.updateShares(newPartners)).to.be.revertedWith(
        'Shares must add up to 100%'
      );
    });

    it('Should fail if a share is 0', async function () {
      const [, , , , , , newPartner1, newPartner2, newPartner3, newPartner4] =
        await hardhat.getSigners();

      const newPartners = await buildPartners(
        [newPartner1, newPartner2, newPartner3, newPartner4],
        [30, 30, 40, 0]
      );

      await expect(collector.updateShares(newPartners)).to.be.revertedWith(
        '0 is not a valid share'
      );
    });
  });

  describe('updateRemainderAddress', function () {
    beforeEach(async function () {
      await deployCollector();
    });

    it('Should update remainder address when token balance is zero', async function () {
      const [, , , , , , newRemainderDestination] = await hardhat.getSigners();

      await collector.updateRemainderAddress(newRemainderDestination.address);

      expect(collector.updateRemainderAddress).to.have.been.called;
    });

    it('Should update remainder when token balance is a remainder and should withdraw remainder', async function () {
      fakeToken.balanceOf.returns(3);

      const [, , , , , , newRemainderDestination] = await hardhat.getSigners();

      await collector.updateRemainderAddress(newRemainderDestination.address);

      expect(fakeToken.transfer).to.have.been.calledWith(
        remainderDestination.address,
        3
      );
    });

    it('Should withdraw when the remainders address sent is the same as the current one', async function () {
      fakeToken.balanceOf.returns(3);

      await collector.updateRemainderAddress(remainderDestination.address);

      expect(fakeToken.transfer).to.have.been.calledWith(
        remainderDestination.address,
        3
      );
    });

    it('Should fail when token balance > = remainder', async function () {
      fakeToken.balanceOf.returns(5);

      const [, , , , , , newRemainderDestination] = await hardhat.getSigners();

      await expect(
        collector.updateRemainderAddress(newRemainderDestination.address)
      ).to.be.revertedWith('There is balance to share');
    });

    it('Should fail when is called by an address that is not the owner', async function () {
      fakeToken.balanceOf.returns(5);

      const [, , , , , , newRemainderDestination, notTheOwner] =
        await hardhat.getSigners();

      await expect(
        collector
          .connect(notTheOwner)
          .updateRemainderAddress(newRemainderDestination.address)
      ).to.be.revertedWith('Only owner can call this');
    });
  });

  describe('getBalance()', function () {
    beforeEach(async function () {
      await deployCollector();
    });

    it('Should return 0 if the contract has been just deployed', async function () {
      fakeToken.balanceOf.returns(0);

      expect(await collector.getBalance()).to.equal(0);
    });

    describe('updateRemainderAddress', function () {
      it('Should fail if the transfer returns false', async function () {
        const [owner, , newRemainder] = await hardhat.getSigners();

        fakeToken['transfer'].returns(false);
        fakeToken['balanceOf'].returns(2);

        await expect(
          collector.updateRemainderAddress(newRemainder.address, {
            from: owner.address,
            gasLimit: 100000,
          })
        ).to.be.revertedWith('Unable to transfer remainder');
      });

      it('Should return 100 after that value has been minted', async function () {
        fakeToken.balanceOf.returns(100);

        expect(await collector.getBalance()).to.equal(100);
      });
    });

    describe('withdraw', function () {
      beforeEach(async function () {
        await deployCollector();
      });

      it('Should withdraw', async function () {
        fakeToken.balanceOf.returns(100);
        await collector.withdraw();

        expect(
          fakeToken.transfer,
          'Partner[0] balance'
        ).to.have.been.calledWith(partners[0].beneficiary, PARTNER_SHARES[0]);

        expect(
          fakeToken.transfer,
          'Partner[1] balance'
        ).to.have.been.calledWith(partners[1].beneficiary, PARTNER_SHARES[1]);

        expect(
          fakeToken.transfer,
          'Partner[2] balance'
        ).to.have.been.calledWith(partners[2].beneficiary, PARTNER_SHARES[2]);

        expect(
          fakeToken.transfer,
          'Partner[3] balance'
        ).to.have.been.calledWith(partners[3].beneficiary, PARTNER_SHARES[3]);
      });

      it('Should not fail if the revenue to share is equal to the number of partners', async function () {
        // We assume the current balance of the collector to be
        // equal to the number of partners
        fakeToken.balanceOf.returns(NUMBER_OF_PARTNERS);

        await collector.withdraw();

        expect(fakeToken.transfer).to.have.callCount(4);
      });

      it('Should fail when no revenue to share', async function () {
        fakeToken.balanceOf.returns(NUMBER_OF_PARTNERS - 1);

        await expect(collector.withdraw()).to.be.revertedWith(
          'Not enough balance to split'
        );
      });

      it('Should fail when is called by an address that is not the owner', async function () {
        fakeToken.balanceOf.returns(100);

        const [, , , , , , notTheOwner] = await hardhat.getSigners();

        await expect(
          collector.connect(notTheOwner).withdraw()
        ).to.be.revertedWith('Only owner can call this');
      });

      it('Should fail if the transfer returns false', async function () {
        const [owner] = await hardhat.getSigners();

        fakeToken['transfer'].returns(false);
        fakeToken['balanceOf'].returns(100);

        await expect(
          collector.withdraw({ from: owner.address, gasLimit: 1000000 })
        ).to.be.revertedWith('Unable to withdraw');
      });
    });

    describe('transferOwnership', function () {
      beforeEach(async function () {
        await deployCollector();
      });

      it('Should transfer ownership', async function () {
        const [, , , , , , newOwner] = await hardhat.getSigners();

        await collector.transferOwnership(newOwner.address);

        expect(await collector.owner()).to.be.equal(newOwner.address);
      });

      it('Should fail when is called by an address that is not the owner', async function () {
        const [, , , , , , newOwner, notTheOwner] = await hardhat.getSigners();

        await expect(
          collector.connect(notTheOwner).transferOwnership(newOwner.address)
        ).to.be.revertedWith('Only owner can call this');
      });
    });
  });
});
