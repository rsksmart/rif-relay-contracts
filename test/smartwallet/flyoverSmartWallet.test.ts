import { smock } from '@defi-wonderland/smock';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { constants, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { FlyoverSmartWallet } from 'typechain-types';
import { createFlyoverPegInQuote, encodeRegisterPegIn } from '../flyover/utils';
import {
  deployFlyoverTestContext,
  deployUninitializedFlyoverWallet,
  FlyoverCollateralFake,
  FlyoverPegInFake,
  FlyoverTestContext,
} from '../flyover/setup';
import { createRelayRequest } from './utils';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe('FlyoverSmartWallet', function () {
  let chainId: number;
  let flyover: FlyoverTestContext;
  let pegInFake: FlyoverPegInFake;
  let collateralFake: FlyoverCollateralFake;
  let smartWallet: FlyoverSmartWallet;
  let owner: Wallet;
  let feesReceiverAddress: string;
  let fundedAccount: SignerWithAddress;

  before(async function () {
    ({ chainId } = await ethers.provider.getNetwork());
  });

  beforeEach(async function () {
    [fundedAccount] = await ethers.getSigners();
    feesReceiverAddress = Wallet.createRandom().address;
    flyover = await deployFlyoverTestContext();
    pegInFake = flyover.pegInFake;
    collateralFake = flyover.collateralFake;

    smartWallet = await deployUninitializedFlyoverWallet(
      pegInFake.address,
      collateralFake.address
    );

    owner = ethers.Wallet.createRandom();
    await fundedAccount.sendTransaction({
      to: owner.address,
      value: ethers.utils.parseEther('1'),
    });
  });

  const buildRegisterPegInData = () => {
    const quote = createFlyoverPegInQuote(pegInFake.address, chainId, {
      rskRefundAddress: owner.address,
    });

    return encodeRegisterPegIn(quote);
  };

  const initializeWallet = async (data: string) => {
    await smartWallet.initialize(
      owner.address,
      constants.AddressZero,
      feesReceiverAddress,
      0,
      0,
      pegInFake.address,
      0,
      data
    );
  };

  describe('constructor', function () {
    it('should store pegIn and collateral management addresses', async function () {
      await expect(smartWallet.pegInContract()).to.eventually.equal(
        pegInFake.address
      );
      await expect(smartWallet.collateralManagement()).to.eventually.equal(
        collateralFake.address
      );
    });
  });

  describe('receive', function () {
    it('should reject native transfers', async function () {
      await expect(
        fundedAccount.sendTransaction({
          to: smartWallet.address,
          value: 1,
        })
      ).to.be.rejectedWith('Not supported');
    });
  });

  describe('execute', function () {
    it('should always revert', async function () {
      const relayRequest = createRelayRequest({ from: owner.address });

      await expect(
        smartWallet.execute(
          constants.HashZero,
          relayRequest.request,
          feesReceiverAddress,
          '0x'
        )
      ).to.be.rejectedWith('Not supported');
    });
  });

  describe('initialize', function () {
    it('should call registerPegIn and initialize the wallet', async function () {
      flyover.configureRegisterPegInSuccess(1);

      await initializeWallet(buildRegisterPegInData());

      await expect(smartWallet.isInitialized()).to.eventually.be.true;
      expect(await smartWallet.domainSeparator()).to.be.properHex(64);
    });

    it('should withdraw punisher rewards to feesReceiver', async function () {
      const reward = ethers.utils.parseEther('0.005');
      flyover.configureRegisterPegInSuccess(1);
      flyover.setWalletReward(smartWallet.address, reward);

      await initializeWallet(buildRegisterPegInData());

      expect(collateralFake.withdrawRewards).to.have.been.calledOnce;
      expect(collateralFake.withdrawRewards.atCall(0)).to.have.been.calledWith(
        feesReceiverAddress
      );
    });

    it('should reject double initialization', async function () {
      flyover.configureRegisterPegInSuccess(1);
      const data = buildRegisterPegInData();
      await initializeWallet(data);

      await expect(
        smartWallet.initialize(
          owner.address,
          constants.AddressZero,
          feesReceiverAddress,
          0,
          0,
          pegInFake.address,
          0,
          data
        )
      ).to.be.rejectedWith('Already initialized');
    });

    it('should reject ERC20 token contract', async function () {
      await expect(
        smartWallet.initialize(
          owner.address,
          feesReceiverAddress,
          feesReceiverAddress,
          0,
          0,
          pegInFake.address,
          0,
          buildRegisterPegInData()
        )
      ).to.be.rejectedWith('ERC20 not supported');
    });

    it('should reject non-zero value', async function () {
      await expect(
        smartWallet.initialize(
          owner.address,
          constants.AddressZero,
          feesReceiverAddress,
          0,
          0,
          pegInFake.address,
          1,
          buildRegisterPegInData()
        )
      ).to.be.rejectedWith('Value must be zero');
    });

    it('should reject non-zero tokenAmount', async function () {
      await expect(
        smartWallet.initialize(
          owner.address,
          constants.AddressZero,
          feesReceiverAddress,
          1,
          0,
          pegInFake.address,
          0,
          buildRegisterPegInData()
        )
      ).to.be.rejectedWith('tokenAmount must be zero');
    });

    it('should reject non-zero tokenGas', async function () {
      await expect(
        smartWallet.initialize(
          owner.address,
          constants.AddressZero,
          feesReceiverAddress,
          0,
          1,
          pegInFake.address,
          0,
          buildRegisterPegInData()
        )
      ).to.be.rejectedWith('tokenGas must be zero');
    });

    it('should reject invalid pegIn target', async function () {
      await expect(
        smartWallet.initialize(
          owner.address,
          constants.AddressZero,
          feesReceiverAddress,
          0,
          0,
          feesReceiverAddress,
          0,
          buildRegisterPegInData()
        )
      ).to.be.rejectedWith('Invalid pegIn target');
    });

    it('should reject invalid registerPegIn selector', async function () {
      await expect(
        smartWallet.initialize(
          owner.address,
          constants.AddressZero,
          feesReceiverAddress,
          0,
          0,
          pegInFake.address,
          0,
          '0xdeadbeef'
        )
      ).to.be.rejectedWith('Invalid registerPegIn call');
    });

    it('should reject when registerPegIn returns non-positive result', async function () {
      flyover.configureRegisterPegInSuccess(-100);

      await expect(
        initializeWallet(buildRegisterPegInData())
      ).to.be.rejectedWith('Register peg in failed');
    });

    it('should bubble revert data from registerPegIn', async function () {
      flyover.configureRegisterPegInRevert('PegIn quote already processed');

      await expect(
        initializeWallet(buildRegisterPegInData())
      ).to.be.rejectedWith('Unable to register peg in');
    });
  });
});
