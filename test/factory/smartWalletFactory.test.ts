import { expect } from 'chai';
import { SmartWallet, SmartWalletFactory, UtilToken } from 'typechain-types';
import { ethers } from 'hardhat';
import { constants, utils, Wallet } from 'ethers';
import { createValidPersonalSignSignature } from '../utils/createValidPersonalSignSignature';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { createDeployRequest } from './utils';
import {
  getLocalEip712DeploySignature,
  TypedDeployRequestData,
} from '../utils/EIP712Utils';
import { getSuffixData, HARDHAT_CHAIN_ID } from '../smartwallet/utils';

const minIndex = 0;
const maxIndex = 1000000000;

const nextIndex = () =>
  Math.floor(Math.random() * (maxIndex - minIndex + 1) + minIndex);

const deployContract = <T>(contract: string) => {
  return ethers
    .getContractFactory(contract)
    .then((contractFactory) => contractFactory.deploy() as T);
};

const provider = ethers.provider;

describe('SmartWalletFactory', function () {
  describe('constructor', function () {
    let smartWalletFactory: SmartWalletFactory;
    let template: Wallet;

    beforeEach(async function () {
      template = ethers.Wallet.createRandom();
      const factory = await ethers.getContractFactory('SmartWalletFactory');
      smartWalletFactory = await factory.deploy(template.address);
    });

    it('should update master copy', async function () {
      await expect(smartWalletFactory.masterCopy()).to.eventually.be.equal(
        template.address
      );
    });
  });

  describe('methods', function () {
    let smartWalletFactory: SmartWalletFactory;
    let owner: Wallet;

    beforeEach(async function () {
      const factory = await ethers.getContractFactory('SmartWalletFactory');
      const template: SmartWallet = await deployContract('SmartWallet');
      smartWalletFactory = await factory.deploy(template.address);
      owner = ethers.Wallet.createRandom();
    });

    describe('createUserSmartWallet', function () {
      let recoverer: string;
      let index: number;

      beforeEach(function () {
        recoverer = constants.AddressZero;
        index = nextIndex();
      });

      it('should initiate the smart wallet in the expected address', async function () {
        const smartWalletAddress =
          await smartWalletFactory.getSmartWalletAddress(
            owner.address,
            recoverer,
            index
          );

        await expect(
          provider.getCode(smartWalletAddress)
        ).to.eventually.be.equal('0x');

        const dataToSign = utils.solidityKeccak256(
          ['address', 'address', 'address', 'uint256'],
          [smartWalletFactory.address, owner.address, recoverer, index]
        );

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );

        const signature = createValidPersonalSignSignature(
          privateKey,
          dataToSign
        );

        await smartWalletFactory.createUserSmartWallet(
          owner.address,
          recoverer,
          index,
          signature
        );

        const smartWallet = await ethers.getContractAt(
          'SmartWallet',
          smartWalletAddress
        );

        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });

      it('should fail with a ZERO owner address parameter', async function () {
        const dataToSign = utils.solidityKeccak256(
          ['address', 'address', 'address', 'uint256'],
          [smartWalletFactory.address, constants.AddressZero, recoverer, index]
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
          smartWalletFactory.createUserSmartWallet(
            owner.address,
            recoverer,
            index,
            signature
          )
        ).to.be.rejectedWith('Invalid signature');
      });

      it('should fail when signature does not match', async function () {
        const dataToSign = utils.solidityKeccak256(
          ['address', 'address', 'address', 'uint256'],
          [smartWalletFactory.address, owner.address, recoverer, index]
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
          smartWalletFactory.createUserSmartWallet(
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
      let otherCaller: SignerWithAddress;
      let token: UtilToken;

      beforeEach(async function () {
        recoverer = constants.AddressZero;
        index = nextIndex();
        smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
          owner.address,
          recoverer,
          index
        );
        [worker, otherCaller] = await ethers.getSigners();
        token = await deployContract('UtilToken');
      });

      it('should initialize the smart wallet in the expected address without paying fee', async function () {
        const initialWorkerBalance = await token.balanceOf(worker.address);

        expect(initialWorkerBalance).to.be.equal(0);
        await expect(
          provider.getCode(smartWalletAddress)
        ).to.eventually.be.equal('0x');

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
            callForwarder: smartWalletFactory.address,
          }
        );

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        await smartWalletFactory
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

        expect(finalWorkerBalance).to.be.equal(0);
        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });

      it('should initialize the smart wallet in the expected address paying fee', async function () {
        const initialWorkerBalance = await token.balanceOf(worker.address);

        expect(initialWorkerBalance).to.be.equal(0);
        await expect(
          provider.getCode(smartWalletAddress)
        ).to.eventually.be.equal('0x');

        await token.mint(1000, smartWalletAddress);

        const amountToBePay = 500;

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
            tokenAmount: amountToBePay,
            tokenGas: 55000,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
          },
          {
            callForwarder: smartWalletFactory.address,
          }
        );

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        await smartWalletFactory
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

        expect(finalWorkerBalance).to.be.equal(amountToBePay);
        await expect(smartWallet.isInitialized()).to.eventually.be.true;
      });

      it('should fail with tokenGas equals to zero paying fee', async function () {
        const initialWorkerBalance = await token.balanceOf(worker.address);

        expect(initialWorkerBalance).to.be.equal(constants.Zero);
        await expect(
          provider.getCode(smartWalletAddress)
        ).to.eventually.be.equal('0x');

        await token.mint(1000, smartWalletAddress);

        const amountToBePay = 500;

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
            tokenAmount: amountToBePay,
            tokenGas: 0,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
          },
          {
            callForwarder: smartWalletFactory.address,
          }
        );

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        await expect(
          smartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to initialize SW');

        const finalWorkerBalance = await token.balanceOf(worker.address);

        expect(finalWorkerBalance).to.be.equal(0);
      });

      it('should fail when owner does not have funds to pay', async function () {
        await token.mint(500, smartWalletAddress);

        const amountToBePay = 1000;

        const deployRequest = createDeployRequest(
          {
            from: owner.address,
            tokenContract: token.address,
            tokenAmount: amountToBePay,
            tokenGas: 55000,
            recoverer: recoverer,
            index: index,
            relayHub: worker.address,
          },
          {
            callForwarder: smartWalletFactory.address,
          }
        );

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        await expect(
          smartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to initialize SW');
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
            callForwarder: smartWalletFactory.address,
          }
        );

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        await expect(
          smartWalletFactory
            .connect(otherCaller)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Invalid caller');
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
            callForwarder: smartWalletFactory.address,
          }
        );

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        await expect(
          smartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('nonce mismatch');
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
            callForwarder: smartWalletFactory.address,
          }
        );

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        const otherAccount = Wallet.createRandom();

        deployRequest.request.from = otherAccount.address;

        await expect(
          smartWalletFactory
            .connect(worker)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Signature mismatch');
      });
    });
  });
});
