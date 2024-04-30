import { expect } from 'chai';
import {
  ERC20,
  MinimalBoltzSmartWallet,
  MinimalBoltzSmartWalletFactory,
  MinimalBoltzSmartWalletFactory__factory,
} from 'typechain-types';
import { ethers } from 'hardhat';
import { constants, utils, Wallet } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { createDeployRequest, randomNumber, signDeployRequest } from './utils';
import { deployContract } from '../../utils/deployment/deployment.utils';
import { FakeContract, smock } from '@defi-wonderland/smock';
import { ZERO_ADDRESS } from '../../test/utils';

type MinimalBoltzSmartWalletFactoryOptions = Parameters<
  MinimalBoltzSmartWalletFactory__factory['deploy']
>;

describe('MinimalBoltzSmartWalletFactory', function () {
  let chainId: number;

  before(async function () {
    ({ chainId } = await ethers.provider.getNetwork());
  });
  describe('methods', function () {
    let boltzSmartWalletFactory: MinimalBoltzSmartWalletFactory;
    let owner: Wallet;

    beforeEach(async function () {
      const { contract: template } = await deployContract<
        MinimalBoltzSmartWallet,
        []
      >({
        contractName: 'MinimalBoltzSmartWallet',
        constructorArgs: [],
      });
      ({ contract: boltzSmartWalletFactory } = await deployContract<
        MinimalBoltzSmartWalletFactory,
        MinimalBoltzSmartWalletFactoryOptions
      >({
        contractName: 'MinimalBoltzSmartWalletFactory',
        constructorArgs: [template.address],
      }));
      owner = ethers.Wallet.createRandom();
    });

    describe('relayedUserSmartWalletCreation', function () {
      let recoverer: string;
      let index: number;
      let smartWalletAddress: string;
      let worker: SignerWithAddress;
      let feesReceiver: Wallet;
      let fundedAccount: SignerWithAddress;
      let fakeToken: FakeContract<ERC20>;
      const tokenGas = 55000;
      let recipient: FakeContract;
      let recipientFunction: string;

      beforeEach(async function () {
        recoverer = constants.AddressZero;
        index = randomNumber();
        smartWalletAddress =
          await boltzSmartWalletFactory.getSmartWalletAddress(
            owner.address,
            recoverer,
            index
          );
        [worker, fundedAccount] = await ethers.getSigners();
        fakeToken = await smock.fake('ERC20');
        feesReceiver = ethers.Wallet.createRandom().connect(ethers.provider);

        const ABI = [
          'function claim(bytes32 preimage, uint amount, address refundAddress, uint timelock)',
        ];
        recipient = await smock.fake(ABI);

        const abiInterface = new ethers.utils.Interface(ABI);
        recipientFunction = abiInterface.encodeFunctionData('claim', [
          constants.HashZero,
          ethers.utils.parseEther('0.5'),
          constants.AddressZero,
          500,
        ]);
      });

      it('should initialize the smart wallet in the expected address without paying fee', async function () {
        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: fakeToken.address,
            tokenAmount: 0,
            tokenGas: 0,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
            data: recipientFunction,
            to: recipient.address,
          },
          {
            callForwarder: boltzSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          boltzSmartWalletFactory.address,
          chainId
        );

        const initialReceiverBalance = await feesReceiver.getBalance();

        await boltzSmartWalletFactory
          .connect(worker)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            feesReceiver.address,
            signature
          );

        const smartWallet = await ethers.getContractAt(
          'MinimalBoltzSmartWallet',
          smartWalletAddress
        );

        const finalReceiverBalance = await feesReceiver.getBalance();

        expect(finalReceiverBalance).to.be.equal(initialReceiverBalance);
        expect(smartWallet.address).to.be.equal(smartWalletAddress);
      });

      it('should initialize the smart wallet in the expected address paying fee using native', async function () {
        const amountToPay = utils.parseEther('2').toString();

        await fundedAccount.sendTransaction({
          to: smartWalletAddress,
          value: amountToPay,
        });

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: constants.AddressZero,
            tokenAmount: amountToPay,
            tokenGas,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
            data: recipientFunction,
            to: recipient.address,
          },
          {
            callForwarder: boltzSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          boltzSmartWalletFactory.address,
          chainId
        );

        const initialReceiverBalance = await feesReceiver.getBalance();

        await boltzSmartWalletFactory
          .connect(worker)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            feesReceiver.address,
            signature
          );

        const smartWallet = await ethers.getContractAt(
          'MinimalBoltzSmartWallet',
          smartWalletAddress
        );

        const finalReceiverBalance = await feesReceiver.getBalance();

        expect(finalReceiverBalance).to.be.equal(
          initialReceiverBalance.add(amountToPay)
        );
        expect(smartWallet.address).to.be.equal(smartWalletAddress);
      });

      it('should fail with tokenGas equals to zero while paying fee', async function () {
        const amountToPay = utils.parseEther('2').toString();

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: ZERO_ADDRESS,
            tokenAmount: amountToPay,
            tokenGas: 0,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
            data: recipientFunction,
            to: recipient.address,
          },
          {
            callForwarder: boltzSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          boltzSmartWalletFactory.address,
          chainId
        );

        const initialReceiverBalance = await feesReceiver.getBalance();

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              feesReceiver.address,
              signature
            )
        ).to.be.rejectedWith('Unable to pay for deployment');

        const finalReceiverBalance = await feesReceiver.getBalance();

        expect(finalReceiverBalance).to.be.equal(initialReceiverBalance);
      });

      it('should fail when the smart wallet does not have funds to pay using native', async function () {
        const amountToPay = utils.parseEther('6').toString();

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: constants.AddressZero,
            tokenAmount: amountToPay,
            tokenGas,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
            data: recipientFunction,
            to: recipient.address,
          },
          {
            callForwarder: boltzSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          boltzSmartWalletFactory.address,
          chainId
        );

        const initialReceiverBalance = await feesReceiver.getBalance();

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              feesReceiver.address,
              signature
            )
        ).to.be.rejectedWith('Unable to pay for deployment');

        const finalReceiverBalance = await feesReceiver.getBalance();

        expect(finalReceiverBalance).to.be.equal(initialReceiverBalance);
      });

      it('should fail when invalid caller(Not relayHub)', async function () {
        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: ZERO_ADDRESS,
            tokenAmount: 0,
            tokenGas: 0,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
            data: recipientFunction,
            to: recipient.address,
          },
          {
            callForwarder: boltzSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          boltzSmartWalletFactory.address,
          chainId
        );

        const initialReceiverBalance = await feesReceiver.getBalance();

        const invalidRelayHub = (await ethers.getSigners()).at(
          1
        ) as SignerWithAddress;

        await expect(
          boltzSmartWalletFactory
            .connect(invalidRelayHub)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              feesReceiver.address,
              signature
            )
        ).to.be.rejectedWith('Invalid caller');

        const finalReceiverBalance = await feesReceiver.getBalance();

        expect(finalReceiverBalance).to.be.equal(initialReceiverBalance);
      });

      it('should fail when nonce does not match', async function () {
        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: ZERO_ADDRESS,
            tokenAmount: 0,
            tokenGas: 0,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
            nonce: 1,
            data: recipientFunction,
            to: recipient.address,
          },
          {
            callForwarder: boltzSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          boltzSmartWalletFactory.address,
          chainId
        );

        const initialReceiverBalance = await feesReceiver.getBalance();

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              feesReceiver.address,
              signature
            )
        ).to.be.rejectedWith('nonce mismatch');

        const finalReceiverBalance = await feesReceiver.getBalance();

        expect(finalReceiverBalance).to.be.equal(initialReceiverBalance);
      });

      it('should fail when signature does not match', async function () {
        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: ZERO_ADDRESS,
            tokenAmount: 0,
            tokenGas: 0,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
          },
          {
            callForwarder: boltzSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          boltzSmartWalletFactory.address,
          chainId
        );

        const otherAccount = Wallet.createRandom();

        deployRequest.request.from = otherAccount.address;

        const initialReceiverBalance = await feesReceiver.getBalance();

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              feesReceiver.address,
              signature
            )
        ).to.be.rejectedWith('Signature mismatch');

        const finalReceiverBalance = await feesReceiver.getBalance();

        expect(finalReceiverBalance).to.be.equal(initialReceiverBalance);
      });

      it('should fail if contract execution fail', async function () {
        recipient['claim'].reverts();

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenAmount: 0,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
            data: recipientFunction,
            to: recipient.address,
          },
          {
            callForwarder: boltzSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          boltzSmartWalletFactory.address,
          chainId
        );

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              feesReceiver.address,
              signature
            )
        ).to.be.rejectedWith('Unable to execute');
      });

      it('should initialize the smart wallet in the expected address and execute the destination contract', async function () {
        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenAmount: 0,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
            data: recipientFunction,
            to: recipient.address,
          },
          {
            callForwarder: boltzSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          boltzSmartWalletFactory.address,
          chainId
        );

        await boltzSmartWalletFactory
          .connect(worker)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            feesReceiver.address,
            signature
          );

        const smartWallet = await ethers.getContractAt(
          'MinimalBoltzSmartWallet',
          smartWalletAddress
        );

        expect(recipient['claim']).to.be.called;
        expect(smartWallet.address).to.be.equal(smartWalletAddress);
      });
    });
  });
});
