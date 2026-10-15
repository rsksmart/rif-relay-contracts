import { MockContract, smock } from '@defi-wonderland/smock';
import {
  MinimalSwapSmartWallet,
  MinimalSwapSmartWallet__factory,
} from 'typechain-types';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers as hardhat } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = hardhat.constants.AddressZero;

// EtherSwap claim methods the minimal Boltz wallet can execute
const BOLTZ_CLAIM_METHODS = ['0xc3c37fbc', '0xcd413efa'];

describe('MinimalSwapSmartWallet template', function () {
  describe('Function initialize()', function () {
    let smartWalletMock: MockContract<MinimalSwapSmartWallet>;

    beforeEach(async function () {
      const smartWalletFactoryMock =
        await smock.mock<MinimalSwapSmartWallet__factory>(
          'MinimalSwapSmartWallet'
        );

      smartWalletMock = await smartWalletFactoryMock.deploy(
        BOLTZ_CLAIM_METHODS
      );
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
