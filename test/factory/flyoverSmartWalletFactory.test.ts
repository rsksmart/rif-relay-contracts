import { expect } from 'chai';
import { constants, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { FlyoverSmartWallet } from 'typechain-types';
import { createFlyoverPegInQuote, encodeRegisterPegIn } from '../flyover/utils';
import {
  deployFlyoverTestContext,
  FlyoverPegInFake,
  FlyoverTestContext,
} from '../flyover/setup';
import { createDeployRequest, randomNumber, signDeployRequest } from './utils';

describe('FlyoverSmartWalletFactory', function () {
  let chainId: number;
  let flyover: FlyoverTestContext;
  let pegInFake: FlyoverPegInFake;
  let template: FlyoverSmartWallet;
  let owner: Wallet;

  before(async function () {
    ({ chainId } = await ethers.provider.getNetwork());
  });

  beforeEach(async function () {
    flyover = await deployFlyoverTestContext();
    pegInFake = flyover.pegInFake;
    template = flyover.template;
    owner = ethers.Wallet.createRandom();
  });

  describe('constructor', function () {
    it('should set the master copy to the FlyoverSmartWallet template', async function () {
      await expect(flyover.factory.masterCopy()).to.eventually.equal(
        template.address
      );
    });
  });

  describe('relayedUserSmartWalletCreation', function () {
    let recoverer: string;
    let index: number;
    let smartWalletAddress: string;
    let relayHub: SignerWithAddress;
    let feesReceiver: SignerWithAddress;
    let fundedAccount: SignerWithAddress;
    let registerPegInData: string;

    beforeEach(async function () {
      recoverer = constants.AddressZero;
      index = randomNumber();
      smartWalletAddress = await flyover.factory.getSmartWalletAddress(
        owner.address,
        recoverer,
        index
      );
      [relayHub, feesReceiver, fundedAccount] = await ethers.getSigners();

      const quote = createFlyoverPegInQuote(pegInFake.address, chainId, {
        rskRefundAddress: owner.address,
      });
      registerPegInData = encodeRegisterPegIn(quote);

      flyover.configureRegisterPegInSuccess(1);

      await fundedAccount.sendTransaction({
        to: owner.address,
        value: ethers.utils.parseEther('1'),
      });
    });

    const buildDeployRequest = () =>
      createDeployRequest(
        {
          from: owner.address,
          tokenContract: constants.AddressZero,
          tokenAmount: 0,
          tokenGas: 0,
          value: 0,
          recoverer,
          index,
          relayHub: relayHub.address,
          to: pegInFake.address,
          data: registerPegInData,
        },
        {
          callForwarder: flyover.factory.address,
        }
      );

    it('should deploy and initialize a Flyover smart wallet via relay', async function () {
      const deployRequest = buildDeployRequest();
      const { suffixData, signature } = signDeployRequest(
        owner,
        deployRequest,
        flyover.factory.address,
        chainId
      );

      await flyover.factory
        .connect(relayHub)
        .relayedUserSmartWalletCreation(
          deployRequest.request,
          suffixData,
          feesReceiver.address,
          signature
        );

      const smartWallet = await ethers.getContractAt(
        'FlyoverSmartWallet',
        smartWalletAddress
      );

      await expect(smartWallet.isInitialized()).to.eventually.be.true;
      await expect(smartWallet.pegInContract()).to.eventually.equal(
        pegInFake.address
      );
    });

    it('should reject ERC20 token contract on deploy request', async function () {
      const deployRequest = buildDeployRequest();
      deployRequest.request.tokenContract = feesReceiver.address;

      const { suffixData, signature } = signDeployRequest(
        owner,
        deployRequest,
        flyover.factory.address,
        chainId
      );

      await expect(
        flyover.factory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            feesReceiver.address,
            signature
          )
      ).to.be.rejectedWith('ERC20 not supported');
    });

    it('should fail when caller is not the relay hub', async function () {
      const deployRequest = buildDeployRequest();
      const { suffixData, signature } = signDeployRequest(
        owner,
        deployRequest,
        flyover.factory.address,
        chainId
      );

      await expect(
        flyover.factory
          .connect(feesReceiver)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            feesReceiver.address,
            signature
          )
      ).to.be.rejectedWith('Invalid caller');
    });

    it('should fail when signature does not match', async function () {
      const deployRequest = buildDeployRequest();
      const { suffixData, signature } = signDeployRequest(
        owner,
        deployRequest,
        flyover.factory.address,
        chainId
      );

      deployRequest.request.from = Wallet.createRandom().address;

      await expect(
        flyover.factory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            feesReceiver.address,
            signature
          )
      ).to.be.rejectedWith('Signature mismatch');
    });

    it('should fail when registerPegIn reverts during initialization', async function () {
      flyover.configureRegisterPegInRevert('registerPegIn failed');

      const deployRequest = buildDeployRequest();
      const { suffixData, signature } = signDeployRequest(
        owner,
        deployRequest,
        flyover.factory.address,
        chainId
      );

      await expect(
        flyover.factory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            feesReceiver.address,
            signature
          )
      ).to.be.rejectedWith('Unable to register peg in');
    });

    it('should bubble revert data from registerPegIn', async function () {
      flyover.configureRegisterPegInRevert('PegIn quote already processed');

      const deployRequest = buildDeployRequest();
      const { suffixData, signature } = signDeployRequest(
        owner,
        deployRequest,
        flyover.factory.address,
        chainId
      );

      await expect(
        flyover.factory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            feesReceiver.address,
            signature
          )
      ).to.be.rejectedWith('Unable to register peg in');
    });
  });
});
