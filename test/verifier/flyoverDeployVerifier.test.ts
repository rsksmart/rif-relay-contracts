import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { constants, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { EnvelopingTypes } from 'typechain-types/contracts/RelayHub';
import { createFlyoverPegInQuote, encodeRegisterPegIn } from '../flyover/utils';
import { deployFlyoverTestContext, FlyoverTestContext } from '../flyover/setup';

chai.use(chaiAsPromised);

describe('FlyoverDeployVerifier', function () {
  let chainId: number;
  let relayWorker: SignerWithAddress;
  let flyover: FlyoverTestContext;
  let quoteOwner: Wallet;
  let registerPegInData: string;

  before(async function () {
    ({ chainId } = await ethers.provider.getNetwork());
  });

  beforeEach(async function () {
    relayWorker = await ethers.getSigners().then((signers) => signers[1]);
    flyover = await deployFlyoverTestContext();

    quoteOwner = Wallet.createRandom();
    const quote = createFlyoverPegInQuote(flyover.pegInFake.address, chainId, {
      rskRefundAddress: quoteOwner.address,
    });
    registerPegInData = encodeRegisterPegIn(quote);
  });

  const buildDeployRequest = (
    overrides: Partial<EnvelopingTypes.DeployRequestStruct['request']> = {}
  ): EnvelopingTypes.DeployRequestStruct => ({
    relayData: {
      callForwarder: flyover.factory.address,
      callVerifier: flyover.deployVerifier.address,
      gasPrice: '10',
      feesReceiver: relayWorker.address,
    },
    request: {
      recoverer: constants.AddressZero,
      index: '0',
      data: registerPegInData,
      from: quoteOwner.address,
      to: flyover.pegInFake.address,
      nonce: '0',
      tokenGas: '0',
      relayHub: constants.AddressZero,
      tokenAmount: '0',
      tokenContract: constants.AddressZero,
      validUntilTime: '0',
      value: '0',
      ...overrides,
    },
  });

  describe('constructor', function () {
    it('should deploy', function () {
      expect(flyover.deployVerifier.address).to.be.a.properAddress;
    });
  });

  describe('setMinPunisherReward', function () {
    it('should update minPunisherReward', async function () {
      const minReward = ethers.utils.parseEther('0.001');
      await flyover.deployVerifier.setMinPunisherReward(minReward);
      await expect(
        flyover.deployVerifier.minPunisherReward()
      ).to.eventually.equal(minReward);
    });

    it('should revert if caller is not the owner', async function () {
      await expect(
        flyover.deployVerifier.connect(relayWorker).setMinPunisherReward(1)
      ).to.be.revertedWith('Caller is not the owner');
    });
  });

  describe('versionVerifier', function () {
    it('should return the verifier version', async function () {
      await expect(
        flyover.deployVerifier.versionVerifier()
      ).to.eventually.equal('rif.enveloping.token.iverifier@2.0.1');
    });
  });

  describe('verifyRelayedCall', function () {
    it('should accept a valid zero-payment registerPegIn deploy request', async function () {
      const deployRequest = buildDeployRequest();

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.not.be.reverted;
    });

    it('should revert for ERC20 token contract', async function () {
      const deployRequest = buildDeployRequest({
        tokenContract: relayWorker.address,
      });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('ERC20 not supported');
    });

    it('should revert when destination is zero address', async function () {
      const deployRequest = buildDeployRequest({ to: constants.AddressZero });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('SW needs a contract execution');
    });

    it('should revert when value is not zero', async function () {
      const deployRequest = buildDeployRequest({ value: '1' });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('Value must be zero');
    });

    it('should revert when tokenAmount is not zero', async function () {
      const deployRequest = buildDeployRequest({ tokenAmount: '1' });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('tokenAmount must be zero');
    });

    it('should revert when tokenGas is not zero', async function () {
      const deployRequest = buildDeployRequest({ tokenGas: '1' });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('tokenGas must be zero');
    });

    it('should revert when destination contract is not allowed', async function () {
      const deployRequest = buildDeployRequest();

      await flyover.deployVerifier.removeContract(flyover.pegInFake.address, 0);

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('Destination contract not allowed');
    });

    it('should revert for invalid registerPegIn selector', async function () {
      const deployRequest = buildDeployRequest({ data: '0xdeadbeef' });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('Invalid registerPegIn call');
    });

    it('should revert when quote lbcAddress does not match pegIn contract', async function () {
      const quote = createFlyoverPegInQuote(relayWorker.address, chainId);
      const deployRequest = buildDeployRequest({
        data: encodeRegisterPegIn(quote),
      });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('Invalid quote lbcAddress');
    });

    it('should revert when quote chainId does not match', async function () {
      const quote = createFlyoverPegInQuote(
        flyover.pegInFake.address,
        chainId + 1
      );
      const deployRequest = buildDeployRequest({
        data: encodeRegisterPegIn(quote),
      });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('Invalid quote chainId');
    });

    it('should revert when penalty fee is zero', async function () {
      const quote = createFlyoverPegInQuote(
        flyover.pegInFake.address,
        chainId,
        {
          penaltyFee: '0',
        }
      );
      const deployRequest = buildDeployRequest({
        data: encodeRegisterPegIn(quote),
      });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('Penalty fee must be positive');
    });

    it('should revert when penalization does not apply because callForUser was done', async function () {
      const quote = createFlyoverPegInQuote(flyover.pegInFake.address, chainId);
      flyover.setQuoteStatus(quote, 1);

      const deployRequest = buildDeployRequest({
        data: encodeRegisterPegIn(quote),
      });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('Penalization does not apply');
    });

    it('should revert when penalization does not apply because quote is processed', async function () {
      const quote = createFlyoverPegInQuote(flyover.pegInFake.address, chainId);
      flyover.setQuoteStatus(quote, 2);

      const deployRequest = buildDeployRequest({
        data: encodeRegisterPegIn(quote),
      });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('Penalization does not apply');
    });

    it('should revert when expected reward is below the configured minimum', async function () {
      const quote = createFlyoverPegInQuote(
        flyover.pegInFake.address,
        chainId,
        {
          penaltyFee: ethers.utils.parseEther('0.001').toString(),
        }
      );
      flyover.setRewardPercentage(1000);
      await flyover.deployVerifier.setMinPunisherReward(
        ethers.utils.parseEther('0.001')
      );

      const deployRequest = buildDeployRequest({
        data: encodeRegisterPegIn(quote),
      });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.be.revertedWith('Reward below minimum');
    });

    it('should accept when expected reward meets the configured minimum', async function () {
      const penaltyFee = ethers.utils.parseEther('0.01');
      const quote = createFlyoverPegInQuote(
        flyover.pegInFake.address,
        chainId,
        {
          penaltyFee: penaltyFee.toString(),
        }
      );
      flyover.setRewardPercentage(5000);
      await flyover.deployVerifier.setMinPunisherReward(penaltyFee.div(2));

      const deployRequest = buildDeployRequest({
        data: encodeRegisterPegIn(quote),
      });

      await expect(
        flyover.deployVerifier.verifyRelayedCall(deployRequest, '0x')
      ).to.not.be.reverted;
    });
  });
});
