import { expect } from 'chai';
import {
  BoltzSmartWallet,
  BoltzSmartWalletFactory,
  BoltzSmartWalletFactory__factory,
  UtilToken,
} from 'typechain-types';
import { ethers } from 'hardhat';
import { constants, utils, Wallet } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { createValidPersonalSignSignature } from '../utils/createValidPersonalSignSignature';
import { createDeployRequest, randomNumber, signDeployRequest } from './utils';
import { deployContract } from '../../utils/deployment/deployment.utils';
import { FakeContract, smock } from '@defi-wonderland/smock';

type BoltzSmartWalletFactoryOptions = Parameters<
  BoltzSmartWalletFactory__factory['deploy']
>;

describe('BoltzSmartWalletFactory', function () {
  let chainId: number;

  before(async function () {
    ({ chainId } = await ethers.provider.getNetwork());
  });

  describe('constructor', function () {
    let boltzSmartWalletFactory: BoltzSmartWalletFactory;
    let template: Wallet;

    beforeEach(async function () {
      template = ethers.Wallet.createRandom();
      ({ contract: boltzSmartWalletFactory } = await deployContract<
        BoltzSmartWalletFactory,
        BoltzSmartWalletFactoryOptions
      >({
        contractName: 'BoltzSmartWalletFactory',
        constructorArgs: [template.address],
      }));
    });

    it('should update master copy', async function () {
      await expect(
        boltzSmartWalletFactory.MASTER_COPY()
      ).to.eventually.be.equal(template.address);
    });
  });

  describe('methods', function () {
    let boltzSmartWalletFactory: BoltzSmartWalletFactory;
    let owner: Wallet;

    beforeEach(async function () {
      const { contract: template } = await deployContract<BoltzSmartWallet, []>(
        {
          contractName: 'BoltzSmartWallet',
          constructorArgs: [],
        }
      );
      ({ contract: boltzSmartWalletFactory } = await deployContract<
        BoltzSmartWalletFactory,
        BoltzSmartWalletFactoryOptions
      >({
        contractName: 'BoltzSmartWalletFactory',
        constructorArgs: [template.address],
      }));
      owner = ethers.Wallet.createRandom();
    });

    describe('createUserSmartWallet', function () {
      let recoverer: string;
      let index: number;

      beforeEach(function () {
        recoverer = constants.AddressZero;
        index = randomNumber();
      });

      it('should initiate the smart wallet in the expected address', async function () {
        const smartWalletAddress =
          await boltzSmartWalletFactory.getSmartWalletAddress(
            owner.address,
            recoverer,
            index
          );

        const dataToSign = utils.solidityKeccak256(
          ['address', 'address', 'address', 'uint256'],
          [boltzSmartWalletFactory.address, owner.address, recoverer, index]
        );

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );

        const signature = createValidPersonalSignSignature(
          privateKey,
          dataToSign
        );

        await boltzSmartWalletFactory.createUserSmartWallet(
          owner.address,
          recoverer,
          index,
          signature
        );

        const smartWallet = await ethers.getContractAt(
          'BoltzSmartWallet',
          smartWalletAddress
        );

        expect(smartWallet.address).to.be.equal(smartWalletAddress);
        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });

      it('should fail with a ZERO owner address parameter', async function () {
        const dataToSign = utils.solidityKeccak256(
          ['address', 'address', 'address', 'uint256'],
          [
            boltzSmartWalletFactory.address,
            constants.AddressZero,
            recoverer,
            index,
          ]
        );

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );

        const signature = createValidPersonalSignSignature(
          privateKey,
          dataToSign
        );

        await expect(
          boltzSmartWalletFactory.createUserSmartWallet(
            constants.AddressZero,
            recoverer,
            index,
            signature
          )
        ).to.be.rejectedWith('Invalid signature');
      });

      it('should fail when signature does not match', async function () {
        const dataToSign = utils.solidityKeccak256(
          ['address', 'address', 'address', 'uint256'],
          [boltzSmartWalletFactory.address, owner.address, recoverer, index]
        );

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );

        const signature = createValidPersonalSignSignature(
          privateKey,
          dataToSign
        );

        const otherAccount = Wallet.createRandom();

        await expect(
          boltzSmartWalletFactory.createUserSmartWallet(
            otherAccount.address,
            recoverer,
            index,
            signature
          )
        ).to.be.rejectedWith('Invalid signature');
      });
    });

    describe('relayedUserSmartWalletCreation', function () {
      let recoverer: string;
      let index: number;
      let smartWalletAddress: string;
      let worker: SignerWithAddress;
      let fundedAccount: SignerWithAddress;
      let token: UtilToken;
      const tokenGas = 55000;

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
        ({ contract: token } = await deployContract<UtilToken, []>({
          contractName: 'UtilToken',
          constructorArgs: [],
        }));
        await token.mint(utils.parseEther('5'), smartWalletAddress);
      });

      it('should initialize the smart wallet in the expected address without paying fee', async function () {
        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
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

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await boltzSmartWalletFactory
          .connect(worker)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          );

        const smartWallet = await ethers.getContractAt(
          'BoltzSmartWallet',
          smartWalletAddress
        );

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(initialWorkerBalance);
        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });

      it('should initialize the smart wallet in the expected address paying fee using token', async function () {
        const amountToPay = utils.parseEther('2').toString();

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
            tokenAmount: amountToPay,
            tokenGas,
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

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await boltzSmartWalletFactory
          .connect(worker)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          );

        const smartWallet = await ethers.getContractAt(
          'BoltzSmartWallet',
          smartWalletAddress
        );

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(
          initialWorkerBalance.add(amountToPay)
        );
        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });

      it('should initialize the smart wallet in the expected address paying fee using native', async function () {
        const amountToPay = utils.parseEther('2').toString();
        const feesReceiver = Wallet.createRandom().address;

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

        const initialReceiverBalance = await ethers.provider.getBalance(
          feesReceiver
        );

        await boltzSmartWalletFactory
          .connect(worker)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            feesReceiver,
            signature
          );

        const smartWallet = await ethers.getContractAt(
          'BoltzSmartWallet',
          smartWalletAddress
        );

        const finalReceiverBalance = await ethers.provider.getBalance(
          feesReceiver
        );

        expect(finalReceiverBalance).to.be.equal(
          initialReceiverBalance.add(amountToPay)
        );
        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });

      it('should fail with tokenGas equals to zero while paying fee', async function () {
        const amountToPay = utils.parseEther('2').toString();

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
            tokenAmount: amountToPay,
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

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to pay for deployment');

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(initialWorkerBalance);
      });

      it('should fail when the smart wallet does not have funds to pay using token', async function () {
        const amountToPay = utils.parseEther('6').toString();

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
            tokenAmount: amountToPay,
            tokenGas,
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

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to pay for deployment');

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(initialWorkerBalance);
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

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to pay for deployment');

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(initialWorkerBalance);
      });

      it('should fail when invalid caller(Not relayHub)', async function () {
        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
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

        const initialWorkerBalance = await token.balanceOf(worker.address);

        const invalidRelayHub = (await ethers.getSigners()).at(
          1
        ) as SignerWithAddress;

        await expect(
          boltzSmartWalletFactory
            .connect(invalidRelayHub)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Invalid caller');

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(initialWorkerBalance);
      });

      it('should fail when nonce does not match', async function () {
        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
            tokenAmount: 0,
            tokenGas: 0,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
            nonce: 1,
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

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('nonce mismatch');

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(initialWorkerBalance);
      });

      it('should fail when signature does not match', async function () {
        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
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

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await expect(
          boltzSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Signature mismatch');

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(initialWorkerBalance);
      });

      it('should fail if contract execution fail', async function () {
        const recipient: FakeContract<BoltzSmartWallet> = await smock.fake(
          'BoltzSmartWallet'
        );
        const recipientFunction = recipient.interface.encodeFunctionData(
          'isInitialized',
          []
        );
        recipient.isInitialized.reverts();

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
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to execute');
      });

      it('should pass the revert message from destination contract if fails', async function () {
        const { contract: recipient } = await deployContract<
          BoltzSmartWallet,
          []
        >({
          contractName: 'BoltzSmartWallet',
          constructorArgs: [],
        });
        const recipientFunction = recipient.interface.encodeFunctionData(
          'directExecute',
          [recipient.address, '0x00']
        );

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
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Not the owner of the SmartWallet');
      });

      it('should initialize the smart wallet in the expected address and execute the destination contract', async function () {
        const recipient: FakeContract<BoltzSmartWallet> = await smock.fake(
          'BoltzSmartWallet'
        );
        const recipientFunction = recipient.interface.encodeFunctionData(
          'isInitialized',
          []
        );
        recipient.isInitialized.returns(true);

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
            worker.address,
            signature
          );

        const smartWallet = await ethers.getContractAt(
          'BoltzSmartWallet',
          smartWalletAddress
        );

        expect(recipient.isInitialized).to.be.called;
        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });
    });
  });
});
