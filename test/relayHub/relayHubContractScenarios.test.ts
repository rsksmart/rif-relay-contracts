import { ERR_UNSTAKED, oneRBTC } from '../utils';
import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import {
  Penalizer,
  RelayHub,
  SmartWallet,
  SmartWalletFactory,
  ERC20,
} from '../../typechain-types';
import { createContractDeployer } from './utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  getLocalEip712Signature,
  TypedRequestData,
  RelayRequest,
  ForwardRequest,
  RelayData,
  DeployRequest,
  TypedDeployRequestData,
  getLocalEip712DeploySignature,
} from '../utils/EIP712Utils';
import { IForwarder } from 'typechain-types/contracts/RelayHub';
import { Wallet } from 'ethers';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = ethers.constants.AddressZero;

describe('RelayHub contract - Manager related scenarios', function () {
  let deployRelayHubContract: ReturnType<typeof createContractDeployer>;
  let relayManager: SignerWithAddress, relayManagerAddr: string;
  let relayWorker: SignerWithAddress, relayWorkerAddr: string;
  let relayOwner: SignerWithAddress, relayOwnerAddr: string;
  let anotherRelayManager: SignerWithAddress;

  let fakePenalizer: FakeContract<Penalizer>;
  let mockRelayHub: MockContract<RelayHub>;

  beforeEach(async function () {
    [relayOwner, relayManager, relayWorker, anotherRelayManager] =
      (await ethers.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress,
        SignerWithAddress,
        SignerWithAddress
      ];
    relayManagerAddr = relayManager.address;
    relayWorkerAddr = relayWorker.address;
    relayOwnerAddr = relayOwner.address;

    fakePenalizer = await smock.fake('Penalizer');
  });

  afterEach(function () {
    mockRelayHub = undefined as unknown as MockContract<RelayHub>;
  });

  describe('Manager tests - Stake related scenarios', function () {
    beforeEach(async function () {
      deployRelayHubContract = createContractDeployer(fakePenalizer.address);
      mockRelayHub = await deployRelayHubContract();
    });

    it('Should fail when sender is a RelayManager', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      await assert.isRejected(
        mockRelayHub
          .connect(relayManager)
          .stakeForAddress(anotherRelayManager.address, 1000, {
            value: oneRBTC,
            from: relayManagerAddr,
          }),
        'sender is a relayManager itself',
        'Stake was made with less value than the minimum'
      );
    });
  });

  describe('Manager - RelayRequest scenarios', function () {
    const HARDHAT_CHAIN_ID = 31337;
    let token: FakeContract<ERC20>;
    let smartWallet: FakeContract<SmartWallet>;
    let externalWallet: Wallet;

    function createRequest(
      request: Partial<ForwardRequest>,
      relayData: Partial<RelayData>
    ): RelayRequest {
      const baseRequest: RelayRequest = {
        request: {
          relayHub: ZERO_ADDRESS,
          from: ZERO_ADDRESS,
          to: ZERO_ADDRESS,
          tokenContract: ZERO_ADDRESS,
          value: '0',
          gas: '10000',
          nonce: '0',
          tokenAmount: '1',
          tokenGas: '50000',
          validUntilTime: '0',
          data: '0x',
        } as ForwardRequest,
        relayData: {
          gasPrice: '1',
          feesReceiver: ZERO_ADDRESS,
          callForwarder: ZERO_ADDRESS,
          callVerifier: ZERO_ADDRESS,
        } as RelayData,
      } as RelayRequest;

      return {
        request: {
          ...baseRequest.request,
          ...request,
        },
        relayData: {
          ...baseRequest.relayData,
          ...relayData,
        },
      };
    }

    beforeEach(async function () {
      deployRelayHubContract = createContractDeployer(fakePenalizer.address);
      mockRelayHub = await deployRelayHubContract();
      token = await smock.fake('ERC20');
      token.transfer.returns(true);

      smartWallet = await smock.fake('SmartWallet');
      externalWallet = ethers.Wallet.createRandom();
      externalWallet.connect(ethers.provider);
    });

    afterEach(function () {
      mockRelayHub = undefined as unknown as MockContract<RelayHub>;
    });

    it('Should fail a relayRequest if the manager is in the last block of delay blocks', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      await mockRelayHub
        .connect(relayManager)
        .addRelayWorkers([relayWorkerAddr]);
      await mockRelayHub.workerToManager(relayWorkerAddr);

      await mockRelayHub.unlockStake(relayManagerAddr, {
        from: relayOwnerAddr,
      });

      const relayRequest = createRequest(
        {
          from: externalWallet.address,
          tokenContract: token.address,
          relayHub: mockRelayHub.address,
          tokenAmount: '1',
          tokenGas: '50000',
        },
        {
          feesReceiver: relayWorkerAddr,
        }
      );

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        smartWallet.address,
        relayRequest
      );

      const privateKey = Buffer.from(
        externalWallet.privateKey.substring(2, 66),
        'hex'
      );

      const signature = getLocalEip712Signature(typedRequestData, privateKey);
      //
      mockRelayHub = mockRelayHub.connect(relayWorker);
      await expect(
        mockRelayHub.relayCall(relayRequest, signature)
      ).to.be.rejectedWith(ERR_UNSTAKED);
    });

    it('Should fail a relayRequest if the manager is unstaked', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      let relayWorkersBefore = await mockRelayHub.workerCount(relayManagerAddr);

      assert.equal(
        relayWorkersBefore.toNumber(),
        0,
        `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
      );

      await mockRelayHub
        .connect(relayManager)
        .addRelayWorkers([relayWorkerAddr], {
          from: relayManagerAddr,
        });
      await mockRelayHub.workerToManager(relayWorkerAddr);

      await mockRelayHub.unlockStake(relayManagerAddr, {
        from: relayOwnerAddr,
      });

      //Verifying stake is now unlocked
      let stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
      assert.isTrue(isUnlocked, 'Stake is not unlocked');

      //Moving blocks to be able to unstake
      await mine(Number(stakeInfo.unstakeDelay));
      await ethers.provider.send('evm_increaseTime', [
        Number(stakeInfo.unstakeDelay),
      ]);
      await ethers.provider.send('evm_mine', []);

      stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      const stakeBalanceBefore = ethers.BigNumber.from(stakeInfo.stake);

      const relayOwnerBalanceBefore = ethers.BigNumber.from(
        await ethers.provider.getBalance(relayOwnerAddr)
      );

      const gasPrice = ethers.BigNumber.from('6000000000000');
      const txResponse = await mockRelayHub.withdrawStake(relayManagerAddr, {
        from: relayOwnerAddr,
        gasPrice,
      });

      //Getting the gas used in order to calculate the original balance of the account

      const txReceipt = await ethers.provider.getTransactionReceipt(
        txResponse.hash
      );
      const rbtcUsed = ethers.BigNumber.from(txReceipt.cumulativeGasUsed).mul(
        gasPrice
      );

      const relayOwnerBalanceAfter = ethers.BigNumber.from(
        await ethers.provider.getBalance(relayOwnerAddr)
      );
      assert.isTrue(
        relayOwnerBalanceAfter.eq(
          relayOwnerBalanceBefore.sub(rbtcUsed).add(stakeBalanceBefore)
        ),
        'Withdraw/unstake process have failed'
      );

      stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      const stakeAfterWithdraw = ethers.BigNumber.from(stakeInfo.stake);

      //Verifying there are no more stake balance for the manager
      assert.isTrue(stakeAfterWithdraw.isZero(), 'Stake must be zero');

      relayWorkersBefore = await mockRelayHub.workerCount(relayManagerAddr);
      assert.equal(
        relayWorkersBefore.toNumber(),
        1,
        `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
      );

      const relayRequest = createRequest(
        {
          from: externalWallet.address,
          tokenContract: token.address,
          relayHub: mockRelayHub.address,
          tokenAmount: '1',
          tokenGas: '6000000000000',
        },
        {
          feesReceiver: relayWorkerAddr,
        }
      );

      relayRequest.request.data = '0xdeadbeef';

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        smartWallet.address,
        relayRequest
      );

      const privateKey = Buffer.from(
        externalWallet.privateKey.substring(2, 66),
        'hex'
      );

      const signature = getLocalEip712Signature(typedRequestData, privateKey);

      await assert.isRejected(
        mockRelayHub.connect(relayWorker).relayCall(relayRequest, signature),
        ERR_UNSTAKED,
        'Relay request was properly processed'
      );
    });
  });

  describe('Manager - DeployRequest scenarios', function () {
    const url = 'http://relay.com';

    const HARDHAT_CHAIN_ID = 31337;
    let token: FakeContract<ERC20>;
    let smartWallet: FakeContract<SmartWallet>;
    let externalWallet: Wallet;
    const nextWalletIndex = 500;

    function createRequest(
      request: Partial<IForwarder.DeployRequestStruct> & { gas: string },
      relayData: Partial<RelayData>
    ): DeployRequest {
      const baseRequest: DeployRequest = {
        request: {
          relayHub: ZERO_ADDRESS,
          from: ZERO_ADDRESS,
          to: ZERO_ADDRESS,
          tokenContract: ZERO_ADDRESS,
          value: '0',
          nonce: '0',
          tokenAmount: '1',
          tokenGas: '50000',
          gas: '0',
          data: '0x',
          recoverer: '0',
          validUntilTime: '0',
          index: 0,
        },
        relayData: {
          gasPrice: '1',
          feesReceiver: ZERO_ADDRESS,
          callForwarder: ZERO_ADDRESS,
          callVerifier: ZERO_ADDRESS,
        },
      };

      return {
        request: {
          ...baseRequest.request,
          ...request,
        },
        relayData: {
          ...baseRequest.relayData,
          ...relayData,
        },
      };
    }

    beforeEach(async function () {
      token = await smock.fake('ERC20');
      token.transfer.returns(true);

      deployRelayHubContract = createContractDeployer(fakePenalizer.address);
      mockRelayHub = await deployRelayHubContract();

      smartWallet = await smock.fake('SmartWallet');
      externalWallet = ethers.Wallet.createRandom();
      externalWallet.connect(ethers.provider);
    });

    afterEach(function () {
      mockRelayHub = undefined as unknown as MockContract<RelayHub>;
    });

    it('Should failed a deployRequest if SmartWallet has already been initialized', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: ethers.BigNumber.from(2),
        from: relayOwnerAddr,
      });

      await mockRelayHub
        .connect(relayManager)
        .addRelayWorkers([relayWorkerAddr]);
      await mockRelayHub.connect(relayManager).registerRelayServer(url);

      const smartWalletFactory: FakeContract<SmartWalletFactory> =
        await smock.fake<SmartWalletFactory>('SmartWalletFactory');
      smartWalletFactory.relayedUserSmartWalletCreation.reverts();

      const relayRequestMisbehavingVerifier = createRequest(
        {
          from: externalWallet.address,
          to: ZERO_ADDRESS,
          data: '0x',
          tokenContract: token.address,
          relayHub: mockRelayHub.address,
          tokenAmount: '1',
          tokenGas: '50000',
          recoverer: ZERO_ADDRESS,
          index: '0',
          gas: '90000000000000',
        },
        {
          feesReceiver: relayWorkerAddr,
          callForwarder: smartWalletFactory.address,
        }
      );

      relayRequestMisbehavingVerifier.request.index =
        nextWalletIndex.toString();

      const typedRequestData = new TypedDeployRequestData(
        HARDHAT_CHAIN_ID,
        smartWalletFactory.address,
        relayRequestMisbehavingVerifier
      );

      const privateKey = Buffer.from(
        externalWallet.privateKey.substring(2, 66),
        'hex'
      );

      const signature = getLocalEip712DeploySignature(
        typedRequestData,
        privateKey
      );

      await assert.isRejected(
        mockRelayHub
          .connect(relayWorker)
          .deployCall(relayRequestMisbehavingVerifier, signature),
        'Transaction reverted without a reason string',
        'SW was deployed and initialized'
      );
    });

    it('Should faild a deployRequest if Manager is unstaked', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      let relayWorkersBefore = await mockRelayHub.workerCount(relayManagerAddr);

      assert.equal(
        relayWorkersBefore.toNumber(),
        0,
        `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
      );

      await mockRelayHub
        .connect(relayManager)
        .addRelayWorkers([relayWorkerAddr], {
          from: relayManagerAddr,
        });

      await mockRelayHub.workerToManager(relayWorkerAddr);

      await mockRelayHub.unlockStake(relayManagerAddr, {
        from: relayOwnerAddr,
      });

      //Verifying stake is now unlocked
      let stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);

      //Moving blocks to be able to unstake
      await mine(Number(stakeInfo.unstakeDelay));

      stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      const stakeBalanceBefore = ethers.BigNumber.from(stakeInfo.stake);

      const relayOwnerBalanceBefore = ethers.BigNumber.from(
        await ethers.provider.getBalance(relayOwnerAddr)
      );

      const gasPrice = ethers.BigNumber.from('351981441');
      const txResponse = await mockRelayHub.withdrawStake(relayManagerAddr, {
        from: relayOwnerAddr,
        gasPrice,
      });

      //Getting the gas used in order to calculate the original balance of the account
      const txReceipt = await ethers.provider.getTransactionReceipt(
        txResponse.hash
      );
      const rbtcUsed = ethers.BigNumber.from(txReceipt.cumulativeGasUsed).mul(
        gasPrice
      );

      const relayOwnerBalanceAfter = ethers.BigNumber.from(
        await ethers.provider.getBalance(relayOwnerAddr)
      );
      assert.isTrue(
        relayOwnerBalanceAfter.eq(
          relayOwnerBalanceBefore.sub(rbtcUsed).add(stakeBalanceBefore)
        ),
        'Withdraw/unstake process have failed'
      );

      stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      const stakeAfterWithdraw = ethers.BigNumber.from(stakeInfo.stake);

      //Verifying there are no more stake balance for the manager
      assert.isTrue(stakeAfterWithdraw.isZero(), 'Stake must be zero');

      relayWorkersBefore = await mockRelayHub.workerCount(relayManagerAddr);
      assert.equal(
        relayWorkersBefore.toNumber(),
        1,
        `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
      );

      const relayRequestMisbehavingVerifier = createRequest(
        {
          from: externalWallet.address,
          to: ZERO_ADDRESS,
          data: '0x',
          tokenContract: token.address,
          relayHub: mockRelayHub.address,
          tokenAmount: '1',
          tokenGas: '50000',
          recoverer: ZERO_ADDRESS,
          index: '0',
          gas: '900000000000',
        },
        {
          feesReceiver: relayWorkerAddr,
        }
      );

      relayRequestMisbehavingVerifier.request.index =
        nextWalletIndex.toString();

      const typedRequestData = new TypedDeployRequestData(
        HARDHAT_CHAIN_ID,
        smartWallet.address,
        relayRequestMisbehavingVerifier
      );

      const privateKey = Buffer.from(
        externalWallet.privateKey.substring(2, 66),
        'hex'
      );

      const signature = getLocalEip712DeploySignature(
        typedRequestData,
        privateKey
      );

      await assert.isRejected(
        mockRelayHub
          .connect(relayWorker)
          .deployCall(relayRequestMisbehavingVerifier, signature),
        ERR_UNSTAKED,
        'Deploy was processed successfully'
      );
    });

    it('Should fail when registering with no workers assigned to the Manager', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      const relayWorkersBefore = await mockRelayHub.workerCount(
        relayManagerAddr
      );

      assert.equal(
        relayWorkersBefore.toNumber(),
        0,
        `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
      );

      await assert.isRejected(
        mockRelayHub.connect(relayManager).registerRelayServer(url, {
          from: relayManagerAddr,
        }),
        'no relay workers',
        'Relay Server was successfully registered'
      );
    });
  });
});
