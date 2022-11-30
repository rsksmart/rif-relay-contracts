import { oneRBTC } from '../utils/constants';

import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { Penalizer } from 'typechain-types/contracts/Penalizer';
import { RelayHub } from 'typechain-types/contracts/RelayHub';
import { createContractDeployer } from './utils';

import {
  ERR_HUB_BAD_PARAMS,
  ERR_NOT_OWNER,
  ERR_TOO_MANY_WORKERS,
  ERR_UNSTAKED,
  ERR_WORKER_HAS_MANAGER,
} from '../utils/errorMessages.utils';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe('RelayHub Contract', function () {
  let deployRelayHubContract: ReturnType<typeof createContractDeployer>;
  let relayManager: SignerWithAddress, relayManagerAddr: string;
  let relayWorker: SignerWithAddress, relayWorkerAddr: string;
  let relayOwner: SignerWithAddress, relayOwnerAddr: string;
  let otherUsers: SignerWithAddress[];

  let fakePenalizer: FakeContract<Penalizer>;
  let mockRelayHub: MockContract<RelayHub>;

  beforeEach(async function () {
    [relayOwner, relayManager, relayWorker, ...otherUsers] =
      await ethers.getSigners();
    relayManagerAddr = relayManager.address;
    relayWorkerAddr = relayWorker.address;
    relayOwnerAddr = relayOwner.address;

    fakePenalizer = await smock.fake('Penalizer');

    deployRelayHubContract = createContractDeployer(fakePenalizer.address);

    mockRelayHub = await deployRelayHubContract();
  });

  afterEach(function () {
    mockRelayHub = undefined as unknown as MockContract<RelayHub>;
  });

  describe('constructor', function () {
    it('should require maxWorkerCount > 0', async function () {
      const promiseOfRevert = deployRelayHubContract([undefined, '0']);

      await expect(promiseOfRevert).to.have.revertedWith(ERR_HUB_BAD_PARAMS);

      const promiseOfRelayHub = deployRelayHubContract();

      await expect(promiseOfRelayHub).to.not.have.revertedWith(
        ERR_HUB_BAD_PARAMS
      );
    });

    it('should require minimumEntryDepositValue > 0', async function () {
      const promiseOfRevert = deployRelayHubContract([
        undefined,
        undefined,
        '0',
      ]);

      await expect(promiseOfRevert).to.have.revertedWith(ERR_HUB_BAD_PARAMS);

      const promiseOfRelayHub = deployRelayHubContract();

      await expect(promiseOfRelayHub).to.not.have.revertedWith(
        ERR_HUB_BAD_PARAMS
      );
    });

    it('should require minimumUnstakeDelay > 0', async function () {
      const promiseOfRevert = deployRelayHubContract([
        undefined,
        undefined,
        undefined,
        '0',
      ]);

      await expect(promiseOfRevert).to.have.revertedWith(ERR_HUB_BAD_PARAMS);

      const promiseOfRelayHub = deployRelayHubContract();

      await expect(promiseOfRelayHub).to.not.have.revertedWith(
        ERR_HUB_BAD_PARAMS
      );
    });

    it('should require minimumStake > 0', async function () {
      const promiseOfRevert = deployRelayHubContract([
        undefined,
        undefined,
        undefined,
        undefined,
        '0',
      ]);

      await expect(promiseOfRevert).to.have.revertedWith(ERR_HUB_BAD_PARAMS);

      const promiseOfRelayHub = deployRelayHubContract();

      await expect(promiseOfRelayHub).to.not.have.revertedWith(
        ERR_HUB_BAD_PARAMS
      );
    });
  });

  describe('addRelayWorkers', function () {
    it('should register relay worker', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
      });

      const expectedWorkerCount = 1;
      const addWorker = () =>
        mockRelayHub.connect(relayManager).addRelayWorkers([relayWorkerAddr]);

      await expect(
        addWorker(),
        `manager: ${relayManagerAddr}, worker: ${relayWorkerAddr}`
      )
        .to.emit(mockRelayHub, 'RelayWorkersAdded')
        .withArgs(relayManagerAddr, [relayWorkerAddr], expectedWorkerCount);

      const actualWorkerCount = await mockRelayHub.workerCount(
        relayManagerAddr
      );

      expect(actualWorkerCount).to.eq(expectedWorkerCount);
    });

    it('should register an array of workers', async function () {
      const expectedWorkerCount = 55;
      await mockRelayHub.setVariable('maxWorkerCount', expectedWorkerCount);

      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
      });

      const workers = Array.from(Array(expectedWorkerCount)).map(
        () => ethers.Wallet.createRandom().address
      );

      const promiseOfWorkers = mockRelayHub
        .connect(relayManager)
        .addRelayWorkers(workers);

      await expect(promiseOfWorkers)
        .to.emit(mockRelayHub, 'RelayWorkersAdded')
        .withArgs(anyValue, anyValue, expectedWorkerCount);

      const actualWorkerCount = await mockRelayHub.workerCount(
        relayManagerAddr
      );

      expect(expectedWorkerCount).to.eq(actualWorkerCount);
    });

    it('should NOT be able to add workers when Manager is unstaked', async function () {
      const promiseOfWorker = mockRelayHub
        .connect(relayManager)
        .addRelayWorkers([relayWorkerAddr]);

      await expect(promiseOfWorker).to.have.revertedWith(ERR_UNSTAKED);
    });

    describe('with one worker', function () {
      const addWorker = (
        manager: SignerWithAddress,
        workerAddr = relayWorkerAddr
      ) => mockRelayHub.connect(manager).addRelayWorkers([workerAddr]);

      beforeEach(async function () {
        // Add stake to manager
        await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
          value: oneRBTC,
        });

        // Add first worker for relayManager
        await addWorker(relayManager);

        // Enable more than one worker per manager
        await mockRelayHub.setVariable('maxWorkerCount', 2);
      });

      it('shoud map the manager addr onto the worker addr', async function () {
        const expectedManagerAddr = relayManagerAddr;
        const actualManager = await mockRelayHub.workerToManager(
          relayWorkerAddr
        );

        const actualManagerAddr = ethers.utils.getAddress(
          `0x${actualManager.slice(25, actualManager.length - 1)}`
        );

        expect(actualManagerAddr).to.eq(expectedManagerAddr);
      });

      it('should NOT register the same worker twice', async function () {
        // Adding same worker for the same manager second time
        await expect(addWorker(relayManager)).to.be.revertedWith(
          ERR_WORKER_HAS_MANAGER
        );
      });

      it('should NOT register the same worker for different managers', async function () {
        const [anotherRelayManager] = otherUsers;

        await mockRelayHub.stakeForAddress(anotherRelayManager.address, 1000, {
          value: oneRBTC,
        });

        await expect(addWorker(anotherRelayManager)).to.be.revertedWith(
          ERR_WORKER_HAS_MANAGER
        );
      });

      it('should fail when adding more workers than maxWorkerCount', async function () {
        const expectedWorkerCountLimit = 13;
        await mockRelayHub.setVariable(
          'maxWorkerCount',
          expectedWorkerCountLimit
        );

        await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
          value: oneRBTC,
        });

        const workers = Array.from(Array(expectedWorkerCountLimit)).map(
          () => ethers.Wallet.createRandom().address
        );
        const promiseOfWorkers = mockRelayHub
          .connect(relayManager)
          .addRelayWorkers(workers);

        await expect(promiseOfWorkers).to.revertedWith(ERR_TOO_MANY_WORKERS);
      });
    });
  });

  describe('disableRelayWorkers', function () {
    beforeEach(async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
      });

      await mockRelayHub
        .connect(relayManager)
        .addRelayWorkers([relayWorkerAddr]);
    });

    it('should be able to disable worker', async function () {
      const promiseOfDisable = mockRelayHub
        .connect(relayManager)
        .disableRelayWorkers([relayWorkerAddr]);
      const expectedWorkerCount = 0;

      await expect(promiseOfDisable)
        .to.emit(mockRelayHub, 'RelayWorkersDisabled')
        .withArgs(relayManagerAddr, [relayWorkerAddr], expectedWorkerCount);

      const actualWorkerCount = await mockRelayHub.workerCount(
        relayManagerAddr
      );

      expect(actualWorkerCount).to.eq(expectedWorkerCount);
    });

    it.skip('invalid quantity of workers', function () {
      console.log('Not implemented yet');
    });

    it.skip('Check if Relay Manager is staked', function () {
      console.log('Not implemented yet');
    });

    it.skip('Disable more than one worker', function () {
      console.log('Not implemented yet');
    });

    it.skip('Incorrect Manager', function () {
      console.log('Not implemented yet');
    });

    it.skip('Disable a subset of the workers', function () {
      console.log('Not implemented yet');
    });
  });

  describe('stakeForAddress', function () {
    it('Should stake only from owner account', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
      });

      await assert.isRejected(
        mockRelayHub
          .connect(relayManager)
          .stakeForAddress(relayManagerAddr, 1000, {
            value: oneRBTC,
          }),
        ERR_NOT_OWNER,
        'Stake was not made by the owner account'
      );
    });

    it('Should NOT be able to unauthorize/unstake a HUB and then perform a new stake with a worker', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
      });

      await mockRelayHub
        .connect(relayManager)
        .addRelayWorkers([relayWorkerAddr]);
      await mockRelayHub.unlockStake(relayManagerAddr);

      //Verifying stake is now unlocked
      const stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
      assert.isTrue(isUnlocked, 'Stake is not unlocked');

      //Moving blocks to be able to unstake
      await mine(Number(stakeInfo.unstakeDelay));

      const gasPrice = BigNumber.from('6000000000000');
      await assert.isRejected(
        mockRelayHub.withdrawStake(relayWorkerAddr, {
          gasPrice,
        }),
        ERR_NOT_OWNER,
        'Withdraw was made successfully'
      );
    });

    it('Should be able to unauthorize/unstake a HUB then stake should be ZERO', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      await mockRelayHub
        .connect(relayManager)
        .addRelayWorkers([relayWorkerAddr]);
      await mockRelayHub.unlockStake(relayManagerAddr, {
        from: relayOwnerAddr,
      });
      // //
      //Verifying stake is now unlocked
      let stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
      assert.isTrue(isUnlocked, 'Stake is not unlocked');

      //Moving blocks to be able to unstake
      await mine(Number(stakeInfo.unstakeDelay));

      stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      const stakeBalanceBefore = ethers.BigNumber.from(stakeInfo.stake);

      const relayOwnerBalanceBefore = ethers.BigNumber.from(
        await ethers.provider.getBalance(relayOwnerAddr)
      );
      //
      const gasPrice = ethers.BigNumber.from('6000000000000');
      const txResponse = await mockRelayHub.withdrawStake(relayManagerAddr, {
        from: relayOwnerAddr,
        gasPrice,
      });

      // console.log('txResponse', txResponse);
      //
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
    });

    it('Should increment stake & replace stake delay when adding/performing a new stake for a manager', async function () {
      let stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      assert.isTrue(Number(stakeInfo.stake) === 0, 'Stakes is not ZERO');

      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);

      await assert.isRejected(
        mockRelayHub.stakeForAddress(relayManagerAddr, 100, {
          value: ethers.utils.parseEther('10'),
          from: relayOwnerAddr,
        }),
        'unstakeDelay cannot be decreased',
        'Stake was made properly'
      );

      await mockRelayHub.stakeForAddress(relayManagerAddr, 2000, {
        value: ethers.utils.parseEther('10'),
        from: relayOwnerAddr,
      });

      stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);

      assert.strictEqual(
        stakeInfo.unstakeDelay,
        ethers.BigNumber.from('2000'),
        'Unstake delay was not replaced'
      );

      assert.strictEqual(
        stakeInfo.stake,
        ethers.BigNumber.from('11000000000000000000'),
        'Stakes were not added properly'
      );
    });

    it('Should NOT be able to unauthorize/unstake a HUB before reaching the delay blocks minimum', async function () {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      //Adding a new worker to the manager
      await mockRelayHub
        .connect(relayManager)
        .addRelayWorkers([relayWorkerAddr]);

      await mockRelayHub.workerToManager(relayWorkerAddr);

      const gasPrice = ethers.BigNumber.from('6000000000000');
      await assert.isRejected(
        mockRelayHub.withdrawStake(relayManagerAddr, {
          from: relayOwnerAddr,
          gasPrice,
        }),
        'Withdrawal is not scheduled',
        'Withdrawal was completed'
      );

      await mockRelayHub.unlockStake(relayManagerAddr, {
        from: relayOwnerAddr,
      });
      await assert.isRejected(
        mockRelayHub.withdrawStake(relayManagerAddr, {
          from: relayOwnerAddr,
          gasPrice,
        }),
        'Withdrawal is not due',
        'Withdrawal was completed'
      );
    });

    it('Should fail when staking Manager and Owner account are the same when staking', async function () {
      await assert.isRejected(
        mockRelayHub
          .connect(relayManager)
          .stakeForAddress(relayManagerAddr, 1000, {
            value: oneRBTC,
            from: relayManagerAddr,
          }),
        'caller is the relayManager',
        'Stake for manager was made with manager account as owner'
      );
    });

    it('Should fail when stake is less than minimum stake value', async function () {
      await assert.isRejected(
        mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
          value: ethers.utils.parseEther('0'),
          from: relayOwnerAddr,
        }),
        'Insufficient intitial stake',
        'Stake was made with less value than the minimum'
      );
    });

    it('Should fail when sender is a RelayManager', async function () {
      await assert.isRejected(
        mockRelayHub
          .connect(relayManager)
          .stakeForAddress(relayManagerAddr, 1000, {
            value: oneRBTC,
          }),
        'caller is the relayManager',
        'Stake was made with less value than the minimum'
      );
    });
  });
});
