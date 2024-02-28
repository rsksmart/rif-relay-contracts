import { MockContract, smock } from '@defi-wonderland/smock';
import { BoltzSmartWallet, BoltzSmartWallet__factory } from 'typechain-types';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers as hardhat } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = hardhat.constants.AddressZero;

describe('BoltzSmartWallet template', function () {
  describe('Function initialize()', function () {
    let smartWalletMock: MockContract<BoltzSmartWallet>;

    beforeEach(async function () {
      const smartWalletFactoryMock =
        await smock.mock<BoltzSmartWallet__factory>('BoltzSmartWallet');

      smartWalletMock = await smartWalletFactoryMock.deploy();
    });

    it('Should be initialized during the deployment', async function () {
      expect(await smartWalletMock.isInitialized()).to.be.true;
    });

    it('Should fail to initialize if alredy initialized', async function () {
      const [owner] = (await hardhat.getSigners()) as [SignerWithAddress];
      await expect(
        smartWalletMock.initialize(
          owner.address,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          '0',
          '0',
          ZERO_ADDRESS,
          '0',
          '0x00'
        )
      ).to.be.rejectedWith('Already initialized');
    });
  });
});
