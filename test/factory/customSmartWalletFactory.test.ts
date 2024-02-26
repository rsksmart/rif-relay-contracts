import { expect } from 'chai';
import { constants, utils, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { createValidPersonalSignSignature } from '../utils/createValidPersonalSignSignature';
import {
  CustomSmartWalletFactory,
  CustomSmartWalletFactory__factory,
  UtilToken,
} from 'typechain-types';
import { deployContract } from '../../utils/deployment/deployment.utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { createDeployRequest, randomNumber, signDeployRequest } from './utils';

type CustomSmartWalletFactoryOptions = Parameters<
  CustomSmartWalletFactory__factory['deploy']
>;

describe('CustomSmartWalletFactory', function () {
  let chainId: number;

  before(async function () {
    ({ chainId } = await ethers.provider.getNetwork());
  });

  describe('constructor', function () {
    let customSmartWalletFactory: CustomSmartWalletFactory;
    let template: Wallet;

    beforeEach(async function () {
      template = ethers.Wallet.createRandom();
      const factory = await ethers.getContractFactory(
        'CustomSmartWalletFactory'
      );
      customSmartWalletFactory = await factory.deploy(template.address);
    });

    it('should update master copy', async function () {
      await expect(
        customSmartWalletFactory.MASTER_COPY()
      ).to.eventually.be.equal(template.address);
    });
  });

  describe('methods', function () {
    let customSmartWalletFactory: CustomSmartWalletFactory;
    let owner: Wallet;

    beforeEach(async function () {
      const { contract: template } = await deployContract({
        contractName: 'CustomSmartWallet',
        constructorArgs: [],
      });

      ({ contract: customSmartWalletFactory } = await deployContract<
        CustomSmartWalletFactory,
        CustomSmartWalletFactoryOptions
      >({
        contractName: 'CustomSmartWalletFactory',
        constructorArgs: [template.address],
      }));
      owner = ethers.Wallet.createRandom();
    });

    describe('createUserSmartWallet', function () {
      let recoverer: string;
      let index: number;
      let logicAddress: string;
      const initParams = '0x';

      beforeEach(function () {
        recoverer = constants.AddressZero;
        index = randomNumber();
        logicAddress = constants.AddressZero;
      });

      it('should initiate the smart wallet in the expected address', async function () {
        const smartWalletAddress =
          await customSmartWalletFactory.getSmartWalletAddress(
            owner.address,
            recoverer,
            logicAddress,
            utils.keccak256(initParams),
            index
          );

        const dataToSign = utils.solidityKeccak256(
          ['address', 'address', 'address', 'address', 'uint256', 'bytes'],
          [
            customSmartWalletFactory.address,
            owner.address,
            recoverer,
            logicAddress,
            index,
            initParams,
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

        await customSmartWalletFactory.createUserSmartWallet(
          owner.address,
          recoverer,
          logicAddress,
          index,
          initParams,
          signature
        );

        const smartWallet = await ethers.getContractAt(
          'SmartWallet',
          smartWalletAddress
        );

        expect(smartWallet.address).to.be.equal(smartWalletAddress);
        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });

      it('should fail with a ZERO owner address parameter', async function () {
        const dataToSign = utils.solidityKeccak256(
          ['address', 'address', 'address', 'address', 'uint256', 'bytes'],
          [
            customSmartWalletFactory.address,
            constants.AddressZero,
            recoverer,
            logicAddress,
            index,
            initParams,
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
          customSmartWalletFactory.createUserSmartWallet(
            constants.AddressZero,
            recoverer,
            logicAddress,
            index,
            initParams,
            signature
          )
        ).to.be.rejectedWith('Invalid signature');
      });

      it('should fail when signature does not match', async function () {
        const dataToSign = utils.solidityKeccak256(
          ['address', 'address', 'address', 'address', 'uint256', 'bytes'],
          [
            customSmartWalletFactory.address,
            constants.AddressZero,
            recoverer,
            logicAddress,
            index,
            initParams,
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

        const otherAccount = Wallet.createRandom();

        await expect(
          customSmartWalletFactory.createUserSmartWallet(
            otherAccount.address,
            recoverer,
            logicAddress,
            index,
            initParams,
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
      let token: UtilToken;
      const tokenGas = 55000;
      let logicAddress: string;
      const initParams = '0x';

      beforeEach(async function () {
        recoverer = constants.AddressZero;
        logicAddress = constants.AddressZero;
        index = randomNumber();
        smartWalletAddress =
          await customSmartWalletFactory.getSmartWalletAddress(
            owner.address,
            recoverer,
            logicAddress,
            utils.keccak256(initParams),
            index
          );
        [worker] = await ethers.getSigners();
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
            tokenAmount: '0',
            tokenGas: '0',
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
          },
          {
            callForwarder: customSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          customSmartWalletFactory.address,
          chainId
        );

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await customSmartWalletFactory
          .connect(worker)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          );

        const smartWallet = await ethers.getContractAt(
          'SmartWallet',
          smartWalletAddress
        );

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(initialWorkerBalance);
        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });

      it('should initialize the smart wallet in the expected address paying fee', async function () {
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
            callForwarder: customSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          customSmartWalletFactory.address,
          chainId
        );

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await customSmartWalletFactory
          .connect(worker)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          );

        const smartWallet = await ethers.getContractAt(
          'SmartWallet',
          smartWalletAddress
        );

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(
          initialWorkerBalance.add(amountToPay)
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
            callForwarder: customSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          customSmartWalletFactory.address,
          chainId
        );

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await expect(
          customSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to initialize SW');

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(initialWorkerBalance);
      });

      it('should fail when the smart wallet does not have funds to pay', async function () {
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
            callForwarder: customSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          customSmartWalletFactory.address,
          chainId
        );

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await expect(
          customSmartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to initialize SW');

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
            callForwarder: customSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          customSmartWalletFactory.address,
          chainId
        );

        const initialWorkerBalance = await token.balanceOf(worker.address);

        const invalidRelayHub = (await ethers.getSigners()).at(
          1
        ) as SignerWithAddress;

        await expect(
          customSmartWalletFactory
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
            callForwarder: customSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          customSmartWalletFactory.address,
          chainId
        );

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await expect(
          customSmartWalletFactory
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
            callForwarder: customSmartWalletFactory.address,
          }
        );

        const { suffixData, signature } = signDeployRequest(
          owner,
          deployRequest,
          customSmartWalletFactory.address,
          chainId
        );

        const otherAccount = Wallet.createRandom();

        deployRequest.request.from = otherAccount.address;

        const initialWorkerBalance = await token.balanceOf(worker.address);

        await expect(
          customSmartWalletFactory
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
    });
  });
});
