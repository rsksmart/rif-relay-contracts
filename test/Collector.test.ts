import {
  FakeContract,
  MockContract,
  MockContractFactory,
  smock,
} from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers } from 'hardhat';
import { Wallet, BigNumber } from 'ethers';
import { ERC20, Collector, Collector__factory } from '../typechain-types';

chai.use(chaiAsPromised);
chai.use(smock.matchers);

const expect = chai.expect;

const PARTNER_SHARES = [20, 30, 40, 10];

type Partner = {
  beneficiary: string;
  share: number;
};

const buildPartners = async (
  partnerWallets: SignerWithAddress[],
  shares: number[]
) => {
  return Promise.all(
    partnerWallets.map(async (wallet, index) => {
      const partner: Partner = {
        beneficiary: await wallet.getAddress(),
        share: shares[index],
      };

      return partner;
    })
  );
};

type CollectorDeployParams = {
  ownerAddr?: string;
  tokens?: string[];
  partners?: Partner[];
  remainderDestinationAddr?: string;
};

type CollectorDeployFunction = (
  collectorParams: CollectorDeployParams
) => ReturnType<MockContractFactory<Collector__factory>['deploy']>;

const prepareDefaultDeployer =
  (
    collectorFactory: MockContractFactory<Collector__factory>,
    defaultOwnerAddr: string,
    defaultTokens: string[],
    defaultPartners: Partner[],
    defaultRemainderDestinationAddr: string
  ): CollectorDeployFunction =>
  ({
    ownerAddr = defaultOwnerAddr,
    tokens = defaultTokens,
    partners = defaultPartners,
    remainderDestinationAddr = defaultRemainderDestinationAddr,
  }: CollectorDeployParams) =>
    collectorFactory.deploy(
      ownerAddr,
      tokens,
      partners,
      remainderDestinationAddr
    );

describe('Collector', function () {
  let owner: SignerWithAddress;
  let collectorFactory: MockContractFactory<Collector__factory>;
  let fakeERC20Tokens: FakeContract<ERC20>[];
  let partners: Partner[];
  let remainderDestination: SignerWithAddress;
  let partner1: SignerWithAddress;
  let partner2: SignerWithAddress;
  let partner3: SignerWithAddress;
  let partner4: SignerWithAddress;

  beforeEach(async function () {
    [owner, partner1, partner2, partner3, partner4, remainderDestination] =
      await ethers.getSigners();
    partners = await buildPartners(
      [partner1, partner2, partner3, partner4],
      PARTNER_SHARES
    );

    fakeERC20Tokens = await Promise.all(
      Array(2)
        .fill(await smock.fake<ERC20>('ERC20'))
        .map((fakeToken: FakeContract<ERC20>) => {
          fakeToken.transfer.returns(true);

          return fakeToken;
        })
    );

    collectorFactory = await smock.mock<Collector__factory>('Collector');
  });

  describe('constructor()', function () {
    it('Should deploy a Collector with single token', async function () {
      partners = await buildPartners(
        [partner1, partner2, partner3, partner4],
        PARTNER_SHARES
      );
      const expectedTokens = fakeERC20Tokens.map(({ address }) => address)[0];
      const expectedOwnerAddress = owner.address;

      const collector: MockContract<Collector> = await collectorFactory.deploy(
        expectedOwnerAddress,
        [expectedTokens],
        partners,
        remainderDestination.address
      );

      const actualOwnerAddress = await collector.owner();
      const actualTokens = await collector.getTokens();

      expect(actualOwnerAddress, 'Failed to set the owner').to.equal(
        expectedOwnerAddress
      );
      expect(actualTokens.toString(), 'Failed to set tokens').to.equal(
        expectedTokens.toString()
      );
    });

    it('Should deploy a Collector with multiple tokens', async function () {
      partners = await buildPartners(
        [partner1, partner2, partner3, partner4],
        PARTNER_SHARES
      );
      const expectedTokens = fakeERC20Tokens.map(({ address }) => address);
      const expectedOwnerAddress = owner.address;

      const collector: MockContract<Collector> = await collectorFactory.deploy(
        owner.address,
        expectedTokens,
        partners,
        remainderDestination.address
      );
      const actualOwnerAddress = await collector.owner();
      const actualTokens = await collector.getTokens();

      expect(actualOwnerAddress, 'Failed to set the owner').to.equal(
        expectedOwnerAddress
      );
      expect(actualTokens.toString(), 'Failed to set tokens').to.equal(
        expectedTokens.toString()
      );
    });

    it('Should not deploy with invalid shares', async function () {
      const partners = await buildPartners(
        [partner1, partner2, partner3, partner4],
        [25, 25, 25, 26]
      );

      await expect(
        collectorFactory.deploy(
          owner.address,
          fakeERC20Tokens.map(({ address }) => address),
          partners,
          remainderDestination.address
        )
      ).to.be.rejectedWith('Shares must add up to 100%');
    });

    it('Should not deploy if the array of partners is empty', async function () {
      const partners: Partner[] = [];

      await expect(
        collectorFactory.deploy(
          owner.address,
          fakeERC20Tokens.map(({ address }) => address),
          partners,
          remainderDestination.address
        )
      ).to.be.rejectedWith('Shares must add up to 100%');
    });

    it('Should not deploy if a share is 0', async function () {
      const partners = await buildPartners(
        [partner1, partner2, partner3, partner4],
        [30, 30, 0, 40]
      );

      await expect(
        collectorFactory.deploy(
          owner.address,
          fakeERC20Tokens.map(({ address }) => address),
          partners,
          remainderDestination.address
        )
      ).to.be.rejectedWith('0 is not a valid share');
    });
  });

  describe('updateShares', function () {
    let newPartners: Partner[];
    let deployColector: CollectorDeployFunction;

    beforeEach(async function () {
      newPartners = await buildPartners(
        (await ethers.getSigners()).slice(6, 10),
        PARTNER_SHARES
      );

      deployColector = prepareDefaultDeployer(
        collectorFactory,
        owner.address,
        fakeERC20Tokens.map(({ address }) => address),
        partners,
        remainderDestination.address
      );
    });

    it('Should update shares and partners when any token has zero balance', async function () {
      const collector = await deployColector({});

      const expectedPartnersShares = newPartners.map(
        ({ beneficiary, share }) => [beneficiary, share]
      );

      expect(await collector.getPartners()).to.not.have.deep.members(
        expectedPartnersShares
      ); // ensure the state is initially different

      await collector.updateShares(newPartners);
      const actualPartnersShares = (await collector.getPartners()).map(
        (partnerShare) => [partnerShare.beneficiary, partnerShare.share]
      );

      expect(actualPartnersShares).to.have.deep.members(expectedPartnersShares);
    });

    it('Should update shares and partners when all token balances are less than the number of partners', async function () {
      const tokens = fakeERC20Tokens.map((token) => {
        token.balanceOf.returns(3);

        return token.address;
      });
      const collector = await deployColector({
        tokens,
      });
      const expectedPartnersShares = newPartners.map(
        ({ beneficiary, share }) => [beneficiary, share]
      );

      expect(await collector.getPartners()).to.not.have.deep.members(
        expectedPartnersShares
      ); // make sure the state is initially different

      await collector.updateShares(newPartners);
      const actualPartnersShares = (await collector.getPartners()).map(
        (partnerShare) => [partnerShare.beneficiary, partnerShare.share]
      );

      expect(actualPartnersShares).to.have.deep.members(expectedPartnersShares);
    });

    it('Should fail when any token balance > number of partners', async function () {
      fakeERC20Tokens[1].balanceOf.returns(5);

      const collector = await deployColector({
        tokens: fakeERC20Tokens.map(({ address }) => address),
      });

      await expect(collector.updateShares(newPartners)).to.be.rejectedWith(
        'There is balance to share'
      );
    });

    it('Should fail when it is called by an account different than the owner', async function () {
      const collector = await deployColector({});
      const notTheOwner = (await ethers.getSigners()).at(
        11
      ) as SignerWithAddress;

      await expect(
        collector.connect(notTheOwner).updateShares(newPartners)
      ).to.eventually.be.rejectedWith('Only owner can call this');
    });

    it('Should fail if the shares does not sum up to 100', async function () {
      const collector = await deployColector({});
      newPartners[0].share = 25;
      newPartners[1].share = 25;
      newPartners[2].share = 25;
      newPartners[3].share = 26;

      await expect(collector.updateShares(newPartners)).to.be.rejectedWith(
        'Shares must add up to 100%'
      );
    });

    it('Should fail if any one of the shares is 0', async function () {
      const collector = await deployColector({});
      newPartners[3].share = 0;

      await expect(collector.updateShares(newPartners)).to.be.rejectedWith(
        '0 is not a valid share'
      );
    });
  });

  describe('updateRemainderAddress', function () {
    let deployColector: CollectorDeployFunction;

    beforeEach(function () {
      deployColector = prepareDefaultDeployer(
        collectorFactory,
        owner.address,
        fakeERC20Tokens.map(({ address }) => address),
        partners,
        remainderDestination.address
      );
    });

    it('Should update remainder address when any token balance is zero', async function () {
      const collector = await deployColector({});
      const expectedAddress = Wallet.createRandom().address;
      await collector.updateRemainderAddress(expectedAddress);
      const actualAddress = await collector.getRemainderAddress();

      expect(actualAddress).eql(expectedAddress);
    });

    it(`Should withdraw all tokens' non-zero balances to the previous remainder address`, async function () {
      const tokens: string[] = fakeERC20Tokens.map((token) => {
        token.balanceOf.returns(3);

        return token.address;
      });
      const collector = await deployColector({
        tokens,
      });
      const previousRemainderAddress = remainderDestination.address;
      const newRemainderAddress = Wallet.createRandom().address;
      await collector.updateRemainderAddress(newRemainderAddress);

      await Promise.allSettled(
        fakeERC20Tokens.map(async (token, i) => {
          const tokenBalance: BigNumber = await token.balanceOf(
            previousRemainderAddress
          );

          expect(
            token.transfer,
            `Token #${i} @${
              token.address
            } didn't transfer ${tokenBalance.toString()}`
          ).to.have.been.calledWith(remainderDestination.address, tokenBalance);
        })
      );
    });

    it('Should update remainder address when any token balance is non-zero', async function () {
      fakeERC20Tokens[0].balanceOf.returns(1);
      const collector = await deployColector({
        tokens: fakeERC20Tokens.map(({ address }) => address),
      });
      const expectedAddress = Wallet.createRandom().address;
      await collector.updateRemainderAddress(expectedAddress);
      const actualAddress = await collector.getRemainderAddress();

      expect(actualAddress).eql(expectedAddress);
    });

    it('Should fail when any token balance >= remainder', async function () {
      const tokens = fakeERC20Tokens.map((token) => {
        token.balanceOf.returns(5);

        return token.address;
      });
      const collector = await deployColector({ tokens });

      await expect(
        collector.updateRemainderAddress(Wallet.createRandom().address)
      ).to.be.rejectedWith('There is balance to share');
    });

    it('Should reject non-owner calls', async function () {
      const collector = await deployColector({});

      const [newRemainderDestination, notTheOwner] = (
        await ethers.getSigners()
      ).slice(11, 13);

      await expect(
        collector
          .connect(notTheOwner)
          .updateRemainderAddress(newRemainderDestination.address)
      ).to.be.rejectedWith('Only owner can call this');
    });
  });

  describe('withdraw', function () {
    let deployColector: CollectorDeployFunction;

    beforeEach(function () {
      deployColector = prepareDefaultDeployer(
        collectorFactory,
        owner.address,
        fakeERC20Tokens.map(({ address }) => address),
        partners,
        remainderDestination.address
      );
    });

    it('Should withdraw for each parther', async function () {
      const tokens = fakeERC20Tokens.map((token) => {
        token.balanceOf.returns(100);

        return token.address;
      });
      const collector = await deployColector({ tokens });
      await collector.withdraw();

      for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
        for (
          let partnerIndex = 0;
          partnerIndex < partners.length;
          partnerIndex++
        ) {
          expect(
            fakeERC20Tokens[tokenIndex].transfer,
            `Partner[${partnerIndex}] balance for token[${tokenIndex}]`
          ).to.have.been.calledWith(
            partners[partnerIndex].beneficiary,
            PARTNER_SHARES[partnerIndex]
          );
        }
      }
    });

    it('Should not fail if the revenue to share is equal to the number of partners', async function () {
      const expectedTransferCount = partners.length;
      const token = fakeERC20Tokens[0];
      token.balanceOf.returns(expectedTransferCount);
      const collector = await deployColector({ tokens: [token.address] });

      await collector.withdraw();

      expect(token.transfer).to.have.callCount(expectedTransferCount);
    });

    it('Should fail when not enough revenue to share in any of the tokens', async function () {
      const tokens = fakeERC20Tokens.map((token, i) => {
        const isLastToken = fakeERC20Tokens.length - 1;
        token.balanceOf.returns(partners.length - (i === isLastToken ? 1 : 0));

        return token.address;
      });
      const collector = await deployColector({ tokens });

      await expect(collector.withdraw()).to.be.revertedWith(
        'Not enough balance to split'
      );
    });

    it('Should fail if called by non-owner', async function () {
      const collector = await deployColector({});

      const notTheOwner = (await ethers.getSigners()).at(
        11
      ) as SignerWithAddress;

      await expect(
        collector.connect(notTheOwner).withdraw()
      ).to.be.revertedWith('Only owner can call this');
    });

    it('Should fail if the transfer returns false', async function () {
      const token = fakeERC20Tokens[0];
      token.balanceOf.returns(100);
      token.transfer.returns(false);
      const collector = await deployColector({ tokens: [token.address] });

      await expect(collector.withdraw()).to.be.revertedWith(
        'Unable to withdraw'
      );
    });
  });

  describe('transferOwnership', function () {
    let collector: MockContract<Collector>;

    beforeEach(async function () {
      collector = await prepareDefaultDeployer(
        collectorFactory,
        owner.address,
        fakeERC20Tokens.map(({ address }) => address),
        partners,
        remainderDestination.address
      )({});
    });

    it('Should transfer ownership', async function () {
      const { address: newOwnerAddress } = (await ethers.getSigners()).at(
        6
      ) as SignerWithAddress;

      await collector.transferOwnership(newOwnerAddress);

      expect(await collector.owner()).to.be.equal(newOwnerAddress);
    });

    it('Should fail when is called by an address that is not the owner', async function () {
      // const [, , , , , , newOwner, notTheOwner] = await hardhat.getSigners();
      const [newOwner, notCurrentOwner] = (await ethers.getSigners()).slice(
        6,
        8
      );

      await expect(
        collector.connect(notCurrentOwner).transferOwnership(newOwner.address)
      ).to.be.revertedWith('Only owner can call this');
    });
  });
});
