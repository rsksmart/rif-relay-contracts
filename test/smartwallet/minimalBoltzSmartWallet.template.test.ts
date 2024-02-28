import { MockContract, smock } from '@defi-wonderland/smock';
import {
  MinimalBoltzSmartWallet,
  MinimalBoltzSmartWallet__factory,
} from 'typechain-types';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers as hardhat } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = hardhat.constants.AddressZero;

describe('MinimalBoltzSmartWallet template', function () {
  describe('Function initialize()', function () {
    let smartWalletMock: MockContract<MinimalBoltzSmartWallet>;

    beforeEach(async function () {
      const smartWalletFactoryMock =
        await smock.mock<MinimalBoltzSmartWallet__factory>(
          'MinimalBoltzSmartWallet'
        );

      smartWalletMock = await smartWalletFactoryMock.deploy();
    });

    it('Should fail to initialize if alredy initialized', async function () {
      const [owner] = (await hardhat.getSigners()) as [SignerWithAddress];
      await smartWalletMock.setVariables({
        _isInitialized: true,
      });
      await expect(
        smartWalletMock.initialize(
          owner.address,
          ZERO_ADDRESS,
          '0',
          '0',
          ZERO_ADDRESS,
          '0x00'
        )
      ).to.be.rejectedWith('Already initialized');
    });
  });
});
