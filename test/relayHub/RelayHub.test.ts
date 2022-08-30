import { oneRBTC } from '../utils';

import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect, assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers } from 'hardhat';
import { Penalizer } from 'typechain-types/contracts/Penalizer';
import { RelayHub } from 'typechain-types/contracts/RelayHub';
import { createContractDeployer } from './utils';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber } from 'ethers';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe('RelayHub Contract', function() {
  let deployRelayHubContract: ReturnType<typeof createContractDeployer>;
  let relayManager: SignerWithAddress, relayManagerAddr: string;
  let relayWorker: SignerWithAddress, relayWorkerAddr: string;
  let otherUsers: SignerWithAddress[];

  let fakePenalizer: FakeContract<Penalizer>;
  let mockRelayHub: MockContract<RelayHub>;

  beforeEach(async function() {
    [, relayManager, relayWorker, ...otherUsers] =
      await ethers.getSigners();
    relayManagerAddr = relayManager.address;
    relayWorkerAddr = relayWorker.address;

    fakePenalizer = await smock.fake('Penalizer');

    deployRelayHubContract = createContractDeployer(fakePenalizer.address);
  });

  afterEach(function() {
    mockRelayHub = undefined as unknown as MockContract<RelayHub>;
  });

  describe('constructor', function() {
    it('should require maxWorkerCount > 0', async function() {
      const promiseOfRevert = deployRelayHubContract([undefined, '0']);

      await expect(promiseOfRevert).to.have.revertedWith(
        'invalid hub init params'
      );

      const promiseOfRelayHub = deployRelayHubContract();

      await expect(promiseOfRelayHub).to.not.have.revertedWith(
        'invalid hub init params'
      );
    });

    it('should require minimumEntryDepositValue > 0', async function() {
      const promiseOfRevert = deployRelayHubContract([
        undefined,
        undefined,
        '0',
      ]);

      await expect(promiseOfRevert).to.have.revertedWith(
        'invalid hub init params'
      );

      const promiseOfRelayHub = deployRelayHubContract();

      await expect(promiseOfRelayHub).to.not.have.revertedWith(
        'invalid hub init params'
      );
    });

    it('should require minimumUnstakeDelay > 0', async function() {
      const promiseOfRevert = deployRelayHubContract([
        undefined,
        undefined,
        undefined,
        '0',
      ]);

      await expect(promiseOfRevert).to.have.revertedWith(
        'invalid hub init params'
      );

      const promiseOfRelayHub = deployRelayHubContract();

      await expect(promiseOfRelayHub).to.not.have.revertedWith(
        'invalid hub init params'
      );
    });

    it('should require minimumStake > 0', async function() {
      const promiseOfRevert = deployRelayHubContract([
        undefined,
        undefined,
        undefined,
        undefined,
        '0',
      ]);

      await expect(promiseOfRevert).to.have.revertedWith(
        'invalid hub init params'
      );

      const promiseOfRelayHub = deployRelayHubContract();

      await expect(promiseOfRelayHub).to.not.have.revertedWith(
        'invalid hub init params'
      );
    });
  });

  describe('', function() {
    beforeEach(async function() {
      mockRelayHub = await deployRelayHubContract();
    });

    describe('addRelayWorkers', function () {
      it('should register relay worker', async function() {
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
          value: oneRBTC.mul(expectedWorkerCount),
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

        await expect(promiseOfWorker).to.have.revertedWith(
          'RelayManager not staked'
        );
      });

      describe('with one worker', function() {
        const addWorker = (
          manager: SignerWithAddress,
          workerAddr = relayWorkerAddr
        ) => mockRelayHub.connect(manager).addRelayWorkers([workerAddr]);

        beforeEach(async function() {
          // Add stake to manager
          await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
            value: oneRBTC,
          });

          // Add first worker for relayManager
          await addWorker(relayManager);

          // Enable more than one worker per manager
          await mockRelayHub.setVariable('maxWorkerCount', 2);
        });

        it('shoud map the manager addr onto the worker addr', async function() {
          const expectedManagerAddr = relayManagerAddr;
          const actualManager = await mockRelayHub.workerToManager(
            relayWorkerAddr
          );

          const actualManagerAddr = ethers.utils.getAddress(
            `0x${actualManager.slice(25, actualManager.length - 1)}`
          );

          expect(actualManagerAddr).to.eq(expectedManagerAddr);
        });

        it('should NOT register the same worker twice', async function() {
          // Adding same worker for the same manager second time
          await expect(addWorker(relayManager)).to.be.revertedWith(
            'this worker has a manager'
          );
        });

        it('should NOT register the same worker for different managers', async function () {
          const [anotherRelayManager] = otherUsers;

          await mockRelayHub.stakeForAddress(
            anotherRelayManager.address,
            1000,
            {
              value: oneRBTC,
            }
          );

          await expect(addWorker(anotherRelayManager)).to.be.revertedWith(
            'this worker has a manager'
          );
        });

        it('should fail when adding more workers than maxWorkerCount', async function () {
          const expectedWorkerCountLimit = 13;
          await mockRelayHub.setVariable('maxWorkerCount', expectedWorkerCountLimit);

          await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
            value: oneRBTC.mul(expectedWorkerCountLimit),
          });

          const workers = Array.from(Array(expectedWorkerCountLimit)).map(
            () => ethers.Wallet.createRandom().address
          );
          const promiseOfWorkers = mockRelayHub
            .connect(relayManager)
            .addRelayWorkers(workers);

          await expect(promiseOfWorkers).to.revertedWith('too many workers');
        });
      });
    });

    describe('disableRelayWorkers', function() {
      beforeEach(async function() {
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
    });

    describe('stakeForAddress', function() {
      it('Should stake only from owner account', async function() {
        await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
          value: oneRBTC,
        });

        await assert.isRejected(
          mockRelayHub
            .connect(relayManager)
            .stakeForAddress(relayManagerAddr, 1000, {
              value: oneRBTC,
            }),
          'not owner',
          'Stake was not made by the owner account'
        );
      });

      it('Should NOT be able to unauthorize/unstake a HUB and then perform a new stake with a worker', async function() {
        await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
          value: oneRBTC,
        });

        await mockRelayHub.connect(relayManager).addRelayWorkers([relayWorkerAddr]);
        await mockRelayHub.unlockStake(relayManagerAddr);

        //Verifying stake is now unlocked
        const stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
        console.log('stakeInfo :', stakeInfo);
        const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;

        assert.isTrue(isUnlocked, 'Stake is not unlocked');

        //Moving blocks to be able to unstake
        await mine(Number(stakeInfo.unstakeDelay));

        const gasPrice = BigNumber.from('60000000');
        await assert.isRejected(
          mockRelayHub.withdrawStake(relayWorkerAddr, {
            gasPrice,
          }),
          'not owner',
          'Withdraw was made successfully'
        );
      });

      // it('Should be able to unauthorize/unstake a HUB then stake should be ZERO', async () => {
      //   await mockRelayHub.stakeForAddress(relayManager, 1000, {
      //     value: oneRBTC,
      //     from: relayOwner,
      //   });

      //   await mockRelayHub.addRelayWorkers([relayWorker], {
      //     from: relayManager,
      //   });
      //   await mockRelayHub.unlockStake(relayManager, {
      //     from: relayOwner,
      //   });

      //   //Verifying stake is now unlocked
      //   let stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
      //   const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
      //   assert.isTrue(isUnlocked, 'Stake is not unlocked');

      //   //Moving blocks to be able to unstake
      //   await evmMineMany(Number(stakeInfo.unstakeDelay));

      //   stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
      //   const stakeBalanceBefore = toBN(stakeInfo.stake);

      //   const relayOwnerBalanceBefore = toBN(
      //     await web3.eth.getBalance(relayOwner)
      //   );

      //   const gasPrice = toBN('60000000');
      //   const txResponse = await mockRelayHub.withdrawStake(relayManager, {
      //     from: relayOwner,
      //     gasPrice,
      //   });

      //   //Getting the gas used in order to calculate the original balance of the account
      //   const rbtcUsed = toBN(
      //     (await web3.eth.getTransactionReceipt(txResponse.tx))
      //       .cumulativeGasUsed
      //   ).mul(gasPrice);

      //   const relayOwnerBalanceAfter = toBN(
      //     await web3.eth.getBalance(relayOwner)
      //   );
      //   assert.isTrue(
      //     relayOwnerBalanceAfter.eq(
      //       relayOwnerBalanceBefore.sub(rbtcUsed).add(stakeBalanceBefore)
      //     ),
      //     'Withdraw/unstake process have failed'
      //   );

      //   stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
      //   const stakeAfterWithdraw = toBN(stakeInfo.stake);

      //   //Verifying there are no more stake balance for the manager
      //   assert.isTrue(stakeAfterWithdraw.isZero(), 'Stake must be zero');
      // });

      // it('Should increment stake & replace stake delay when adding/performing a new stake for a manager', async () => {
      //   let stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
      //   assert.isTrue(Number(stakeInfo.stake) === 0, 'Stakes is not ZERO');

      //   await mockRelayHub.stakeForAddress(relayManager, 1000, {
      //     value: oneRBTC,
      //     from: relayOwner,
      //   });

      //   stakeInfo = await mockRelayHub.getStakeInfo(relayManager);

      //   await assert.isRejected(
      //     mockRelayHub.stakeForAddress(relayManager, 100, {
      //       value: ether('10'),
      //       from: relayOwner,
      //     }),
      //     'unstakeDelay cannot be decreased',
      //     'Stake was made properly'
      //   );

      //   await mockRelayHub.stakeForAddress(relayManager, 2000, {
      //     value: ether('10'),
      //     from: relayOwner,
      //   });

      //   stakeInfo = await mockRelayHub.getStakeInfo(relayManager);

      //   assert.strictEqual(
      //     stakeInfo.unstakeDelay,
      //     '2000',
      //     'Unstake delay was not replaced'
      //   );
      //   assert.isTrue(
      //     stakeInfo.stake === '11000000000000000000',
      //     'Stakes were not added properly'
      //   );
      // });

      // it('Should NOT be able to unauthorize/unstake a HUB before reaching the delay blocks minimum', async () => {
      //   await mockRelayHub.stakeForAddress(relayManager, 1000, {
      //     value: oneRBTC,
      //     from: relayOwner,
      //   });

      //   //Adding a new worker to the manager
      //   await mockRelayHub.addRelayWorkers([relayWorker], {
      //     from: relayManager,
      //   });
      //   await mockRelayHub.workerToManager(relayWorker);

      //   const gasPrice = toBN('60000000');
      //   await assert.isRejected(
      //     mockRelayHub.withdrawStake(relayManager, {
      //       from: relayOwner,
      //       gasPrice,
      //     }),
      //     'Withdrawal is not scheduled',
      //     'Withdrawal was completed'
      //   );

      //   await mockRelayHub.unlockStake(relayManager, {
      //     from: relayOwner,
      //   });
      //   await assert.isRejected(
      //     mockRelayHub.withdrawStake(relayManager, {
      //       from: relayOwner,
      //       gasPrice,
      //     }),
      //     'Withdrawal is not due',
      //     'Withdrawal was completed'
      //   );
      // });

      // it('Should fail when staking Manager and Owner account are the same when staking', async () => {
      //   await assert.isRejected(
      //     mockRelayHub.stakeForAddress(relayManager, 1000, {
      //       value: oneRBTC,
      //       from: relayManager,
      //     }),
      //     'caller is the relayManager',
      //     'Stake for manager was made with manager account as owner'
      //   );
      // });

      // it('Should fail when stake is less than minimum stake value', async () => {
      //   await assert.isRejected(
      //     mockRelayHub.stakeForAddress(relayManager, 1000, {
      //       value: ether('0.0005'),
      //       from: relayOwner,
      //     }),
      //     'Insufficient intitial stake',
      //     'Stake was made with less value than the minimum'
      //   );
      // });

      // it('Should fail when sender is a RelayManager', async () => {

      //   await assert.isRejected(
      //     mockRelayHub.connect(relayManager).stakeForAddress(relayManagerAddr, 1000, {
      //       value: oneRBTC,
      //     }),
      //     'sender is a relayManager itself',
      //     'Stake was made with less value than the minimum'
      //   );
      // });
    });
  });
});

// contract(
//   'RelayHub contract - Manager related scenarios',
//   ([_, relayOwner, relayManager, relayWorker]) => {
//     let chainId: number;
//     let relayHub: string;
//     let penalizer: PenalizerInstance;
//     let mockRelayHub: mockRelayHub;
//     let recipientContract: TestRecipientInstance;
//     let verifierContract: TestVerifierEverythingAcceptedInstance;
//     let deployVerifierContract: TestDeployVerifierEverythingAcceptedInstance;
//     let forwarderInstance: IForwarderInstance;
//     let target: string;
//     let verifier: string;
//     let forwarder: string;
//     let gaslessAccount: AccountKeypair;
//     const gasLimit = '3000000';
//     const gasPrice = '1';
//     let sharedRelayRequestData: RelayRequest;
//     let sharedDeployRequestData: DeployRequest;

//     let env: Environment;
//     let token: TestTokenInstance;
//     let factory: SmartWalletFactoryInstance;
//     let relayRequest: RelayRequest;

//     let misbehavingVerifier: TestDeployVerifierConfigurableMisbehaviorInstance;
//     let signatureWithMisbehavingVerifier: string;
//     let relayRequestMisbehavingVerifier: DeployRequest;

//     describe('Manager tests - Stake related scenarios', async () => {
//       beforeEach(async function () {
//         penalizer = await Penalizer.new();
//         mockRelayHub = await deployHub(penalizer.address);
//       });

//       it('Should stake only from owner account', async () => {
//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });
//         await assert.isRejected(
//           mockRelayHub.stakeForAddress(relayManager, 1000, {
//             value: oneRBTC,
//             from: _,
//           }),
//           'not owner',
//           'Stake was not made by the owner account'
//         );
//       });

//       it('Should NOT be able to unauthorize/unstake a HUB and then perform a new stake with a worker', async () => {
//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });

//         await mockRelayHub.addRelayWorkers([relayWorker], {
//           from: relayManager,
//         });
//         await mockRelayHub.unlockStake(relayManager, {
//           from: relayOwner,
//         });

//         //Verifying stake is now unlocked
//         const stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
//         assert.isTrue(isUnlocked, 'Stake is not unlocked');

//         //Moving blocks to be able to unstake
//         await evmMineMany(Number(stakeInfo.unstakeDelay));

//         const gasPrice = toBN('60000000');
//         await assert.isRejected(
//           mockRelayHub.withdrawStake(relayWorker, {
//             from: relayOwner,
//             gasPrice,
//           }),
//           'not owner',
//           'Withdraw was made successfully'
//         );
//       });

//       it('Should be able to unauthorize/unstake a HUB then stake should be ZERO', async () => {
//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });

//         await mockRelayHub.addRelayWorkers([relayWorker], {
//           from: relayManager,
//         });
//         await mockRelayHub.unlockStake(relayManager, {
//           from: relayOwner,
//         });

//         //Verifying stake is now unlocked
//         let stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
//         assert.isTrue(isUnlocked, 'Stake is not unlocked');

//         //Moving blocks to be able to unstake
//         await evmMineMany(Number(stakeInfo.unstakeDelay));

//         stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         const stakeBalanceBefore = toBN(stakeInfo.stake);

//         const relayOwnerBalanceBefore = toBN(
//           await web3.eth.getBalance(relayOwner)
//         );

//         const gasPrice = toBN('60000000');
//         const txResponse = await mockRelayHub.withdrawStake(relayManager, {
//           from: relayOwner,
//           gasPrice,
//         });

//         //Getting the gas used in order to calculate the original balance of the account
//         const rbtcUsed = toBN(
//           (await web3.eth.getTransactionReceipt(txResponse.tx))
//             .cumulativeGasUsed
//         ).mul(gasPrice);

//         const relayOwnerBalanceAfter = toBN(
//           await web3.eth.getBalance(relayOwner)
//         );
//         assert.isTrue(
//           relayOwnerBalanceAfter.eq(
//             relayOwnerBalanceBefore.sub(rbtcUsed).add(stakeBalanceBefore)
//           ),
//           'Withdraw/unstake process have failed'
//         );

//         stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         const stakeAfterWithdraw = toBN(stakeInfo.stake);

//         //Verifying there are no more stake balance for the manager
//         assert.isTrue(stakeAfterWithdraw.isZero(), 'Stake must be zero');
//       });

//       it('Should increment stake & replace stake delay when adding/performing a new stake for a manager', async () => {
//         let stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         assert.isTrue(Number(stakeInfo.stake) === 0, 'Stakes is not ZERO');

//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });

//         stakeInfo = await mockRelayHub.getStakeInfo(relayManager);

//         await assert.isRejected(
//           mockRelayHub.stakeForAddress(relayManager, 100, {
//             value: ether('10'),
//             from: relayOwner,
//           }),
//           'unstakeDelay cannot be decreased',
//           'Stake was made properly'
//         );

//         await mockRelayHub.stakeForAddress(relayManager, 2000, {
//           value: ether('10'),
//           from: relayOwner,
//         });

//         stakeInfo = await mockRelayHub.getStakeInfo(relayManager);

//         assert.strictEqual(
//           stakeInfo.unstakeDelay,
//           '2000',
//           'Unstake delay was not replaced'
//         );
//         assert.isTrue(
//           stakeInfo.stake === '11000000000000000000',
//           'Stakes were not added properly'
//         );
//       });

//       it('Should NOT be able to unauthorize/unstake a HUB before reaching the delay blocks minimum', async () => {
//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });

//         //Adding a new worker to the manager
//         await mockRelayHub.addRelayWorkers([relayWorker], {
//           from: relayManager,
//         });
//         await mockRelayHub.workerToManager(relayWorker);

//         const gasPrice = toBN('60000000');
//         await assert.isRejected(
//           mockRelayHub.withdrawStake(relayManager, {
//             from: relayOwner,
//             gasPrice,
//           }),
//           'Withdrawal is not scheduled',
//           'Withdrawal was completed'
//         );

//         await mockRelayHub.unlockStake(relayManager, {
//           from: relayOwner,
//         });
//         await assert.isRejected(
//           mockRelayHub.withdrawStake(relayManager, {
//             from: relayOwner,
//             gasPrice,
//           }),
//           'Withdrawal is not due',
//           'Withdrawal was completed'
//         );
//       });

//       it('Should fail when staking Manager and Owner account are the same when staking', async () => {
//         await assert.isRejected(
//           mockRelayHub.stakeForAddress(relayManager, 1000, {
//             value: oneRBTC,
//             from: relayManager,
//           }),
//           'caller is the relayManager',
//           'Stake for manager was made with manager account as owner'
//         );
//       });

//       it('Should fail when stake is less than minimum stake value', async () => {
//         await assert.isRejected(
//           mockRelayHub.stakeForAddress(relayManager, 1000, {
//             value: ether('0.0005'),
//             from: relayOwner,
//           }),
//           'Insufficient intitial stake',
//           'Stake was made with less value than the minimum'
//         );
//       });

//       it('Should fail when sender is a RelayManager', async () => {
//         mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });

//         await assert.isRejected(
//           mockRelayHub.stakeForAddress(_, 1000, {
//             value: oneRBTC,
//             from: relayManager,
//           }),
//           'sender is a relayManager itself',
//           'Stake was made with less value than the minimum'
//         );
//       });
//     });

//     describe('Manager - RelayRequest scenarios', async () => {
//       let signature: string;
//       const gas = 4e6;

//       beforeEach(async () => {
//         env = await getTestingEnvironment();
//         chainId = env.chainId;

//         penalizer = await Penalizer.new();
//         mockRelayHub = await deployHub(penalizer.address);

//         const smartWalletTemplate: SmartWalletInstance =
//           await SmartWallet.new();
//         factory = await createSmartWalletFactory(smartWalletTemplate);

//         recipientContract = await TestRecipient.new();
//         verifierContract = await TestVerifierEverythingAccepted.new();
//         deployVerifierContract =
//           await TestDeployVerifierEverythingAccepted.new();

//         const testToken = artifacts.require('TestToken');
//         token = await testToken.new();

//         target = recipientContract.address;
//         verifier = verifierContract.address;
//         relayHub = mockRelayHub.address;

//         gaslessAccount = await getGaslessAccount();
//         forwarderInstance = await createSmartWallet(
//           _,
//           gaslessAccount.address,
//           factory,
//           gaslessAccount.privateKey,
//           chainId
//         );
//         forwarder = forwarderInstance.address;
//         await token.mint('1000', forwarder);

//         sharedRelayRequestData = {
//           request: {
//             relayHub: relayHub,
//             to: target,
//             data: '',
//             from: gaslessAccount.address,
//             nonce: (await forwarderInstance.nonce()).toString(),
//             value: '0',
//             gas: gasLimit,
//             tokenContract: token.address,
//             tokenAmount: '1',
//             tokenGas: '50000',
//           },
//           relayData: {
//             gasPrice,
//             relayWorker,
//             callForwarder: forwarder,
//             callVerifier: verifier,
//             domainSeparator: getDomainSeparatorHash(forwarder, chainId),
//           },
//         };

//         relayRequest = cloneRelayRequest(sharedRelayRequestData);
//         relayRequest.request.data = '0xdeadbeef';

//         const dataToSign = new TypedRequestData(
//           chainId,
//           forwarder,
//           relayRequest
//         );
//         signature = getLocalEip712Signature(
//           dataToSign,
//           gaslessAccount.privateKey
//         );
//       });

//       it('Should fail a relayRequest if the manager is unstaked', async () => {
//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });

//         let relayWorkersBefore = await mockRelayHub.workerCount(
//           relayManager
//         );
//         assert.equal(
//           relayWorkersBefore.toNumber(),
//           0,
//           `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
//         );

//         await mockRelayHub.addRelayWorkers([relayWorker], {
//           from: relayManager,
//         });
//         await mockRelayHub.workerToManager(relayWorker);

//         await mockRelayHub.unlockStake(relayManager, {
//           from: relayOwner,
//         });

//         //Verifying stake is now unlocked
//         let stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
//         assert.isTrue(isUnlocked, 'Stake is not unlocked');

//         //Moving blocks to be able to unstake
//         await evmMineMany(Number(stakeInfo.unstakeDelay));

//         stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         const stakeBalanceBefore = toBN(stakeInfo.stake);

//         const relayOwnerBalanceBefore = toBN(
//           await web3.eth.getBalance(relayOwner)
//         );

//         const gasPrice = toBN('60000000');
//         const txResponse = await mockRelayHub.withdrawStake(relayManager, {
//           from: relayOwner,
//           gasPrice,
//         });

//         //Getting the gas used in order to calculate the original balance of the account
//         const rbtcUsed = toBN(
//           (await web3.eth.getTransactionReceipt(txResponse.tx))
//             .cumulativeGasUsed
//         ).mul(gasPrice);

//         const relayOwnerBalanceAfter = toBN(
//           await web3.eth.getBalance(relayOwner)
//         );
//         assert.isTrue(
//           relayOwnerBalanceAfter.eq(
//             relayOwnerBalanceBefore.sub(rbtcUsed).add(stakeBalanceBefore)
//           ),
//           'Withdraw/unstake process have failed'
//         );

//         stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         const stakeAfterWithdraw = toBN(stakeInfo.stake);

//         //Verifying there are no more stake balance for the manager
//         assert.isTrue(stakeAfterWithdraw.isZero(), 'Stake must be zero');

//         relayWorkersBefore = await mockRelayHub.workerCount(relayManager);
//         assert.equal(
//           relayWorkersBefore.toNumber(),
//           1,
//           `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
//         );

//         await assert.isRejected(
//           mockRelayHub.relayCall(relayRequest, signature, {
//             from: relayWorker,
//             gas,
//           }),
//           'RelayManager not staked',
//           'Relay request was properly processed'
//         );
//       });

//       it('Should fail a relayRequest if the manager is in the last block of delay blocks', async () => {
//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });

//         await mockRelayHub.addRelayWorkers([relayWorker], {
//           from: relayManager,
//         });
//         await mockRelayHub.workerToManager(relayWorker);

//         await mockRelayHub.unlockStake(relayManager, {
//           from: relayOwner,
//         });

//         await assert.isRejected(
//           mockRelayHub.relayCall(relayRequest, signature, {
//             from: relayWorker,
//             gas,
//           }),
//           'RelayManager not staked',
//           'Relay request was properly processed'
//         );
//       });
//     });

//     describe('Manager - DeployRequest scenarios', async () => {
//       let min = 0;
//       let max = 1000000000;
//       min = Math.ceil(min);
//       max = Math.floor(max);
//       let nextWalletIndex = Math.floor(Math.random() * (max - min + 1) + min);

//       const gas = 4e6;
//       const url = 'http://relay.com';
//       let deployRequest: DeployRequest;

//       beforeEach(async () => {
//         env = await getTestingEnvironment();
//         chainId = env.chainId;

//         penalizer = await Penalizer.new();
//         mockRelayHub = await deployHub(penalizer.address);
//         verifierContract = await TestVerifierEverythingAccepted.new();
//         deployVerifierContract =
//           await TestDeployVerifierEverythingAccepted.new();
//         gaslessAccount = await getGaslessAccount();

//         const smartWalletTemplate: SmartWalletInstance =
//           await SmartWallet.new();
//         factory = await createSmartWalletFactory(smartWalletTemplate);
//         recipientContract = await TestRecipient.new();

//         const testToken = artifacts.require('TestToken');
//         token = await testToken.new();

//         target = recipientContract.address;
//         verifier = verifierContract.address;
//         relayHub = mockRelayHub.address;

//         sharedDeployRequestData = {
//           request: {
//             relayHub: relayHub,
//             to: constants.ZERO_ADDRESS,
//             data: '0x',
//             from: gaslessAccount.address,
//             nonce: (await factory.nonce(gaslessAccount.address)).toString(),
//             value: '0',
//             tokenContract: token.address,
//             tokenAmount: '1',
//             tokenGas: '50000',
//             recoverer: constants.ZERO_ADDRESS,
//             index: '0',
//           },
//           relayData: {
//             gasPrice,
//             relayWorker,
//             callForwarder: factory.address,
//             callVerifier: deployVerifierContract.address,
//             domainSeparator: getDomainSeparatorHash(factory.address, chainId),
//           },
//         };

//         deployRequest = cloneDeployRequest(sharedDeployRequestData);
//         deployRequest.request.index = nextWalletIndex.toString();
//         misbehavingVerifier =
//           await TestDeployVerifierConfigurableMisbehavior.new();
//         deployRequest.request.index = nextWalletIndex.toString();
//         nextWalletIndex++;

//         relayRequestMisbehavingVerifier = cloneDeployRequest(deployRequest);
//         relayRequestMisbehavingVerifier.relayData.callVerifier =
//           misbehavingVerifier.address;

//         const dataToSign = new TypedDeployRequestData(
//           chainId,
//           factory.address,
//           relayRequestMisbehavingVerifier
//         );
//         signatureWithMisbehavingVerifier = getLocalEip712Signature(
//           dataToSign,
//           gaslessAccount.privateKey
//         );
//       });

//       it('Should faild a deployRequest if SmartWallet has already been initialized', async () => {
//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: ether('2'),
//           from: relayOwner,
//         });
//         await mockRelayHub.addRelayWorkers([relayWorker], {
//           from: relayManager,
//         });
//         await mockRelayHub.registerRelayServer(url, {
//           from: relayManager,
//         });

//         const smartWalletTemplate: SmartWalletInstance =
//           await SmartWallet.new();
//         const senderAccount = web3.eth.accounts.create();

//         smartWalletTemplate.initialize(
//           senderAccount.address,
//           token.address,
//           relayWorker,
//           '0',
//           '400000'
//         );
//         factory = await createSmartWalletFactory(smartWalletTemplate);

//         const calculatedAddr = await factory.getSmartWalletAddress(
//           gaslessAccount.address,
//           constants.ZERO_ADDRESS,
//           relayRequestMisbehavingVerifier.request.index
//         );
//         await token.mint('1', calculatedAddr);

//         await assert.isRejected(
//           mockRelayHub.deployCall(
//             relayRequestMisbehavingVerifier,
//             signatureWithMisbehavingVerifier,
//             { from: relayWorker, gas, gasPrice }
//           ),
//           'Unable to initialize SW',
//           'SW was deployed and initialized'
//         );
//       });

//       it('Should faild a deployRequest if Manager is unstaked', async () => {
//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });

//         let relayWorkersBefore = await mockRelayHub.workerCount(
//           relayManager
//         );
//         assert.equal(
//           relayWorkersBefore.toNumber(),
//           0,
//           `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
//         );

//         await mockRelayHub.addRelayWorkers([relayWorker], {
//           from: relayManager,
//         });
//         await mockRelayHub.workerToManager(relayWorker);

//         await mockRelayHub.unlockStake(relayManager, {
//           from: relayOwner,
//         });

//         //Verifying stake is now unlocked
//         let stakeInfo = await mockRelayHub.getStakeInfo(relayManager);

//         //Moving blocks to be able to unstake
//         await evmMineMany(Number(stakeInfo.unstakeDelay));

//         stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         const stakeBalanceBefore = toBN(stakeInfo.stake);

//         const relayOwnerBalanceBefore = toBN(
//           await web3.eth.getBalance(relayOwner)
//         );

//         const gasPrice = toBN('60000000');
//         const txResponse = await mockRelayHub.withdrawStake(relayManager, {
//           from: relayOwner,
//           gasPrice,
//         });

//         //Getting the gas used in order to calculate the original balance of the account
//         const rbtcUsed = toBN(
//           (await web3.eth.getTransactionReceipt(txResponse.tx))
//             .cumulativeGasUsed
//         ).mul(gasPrice);

//         const relayOwnerBalanceAfter = toBN(
//           await web3.eth.getBalance(relayOwner)
//         );
//         assert.isTrue(
//           relayOwnerBalanceAfter.eq(
//             relayOwnerBalanceBefore.sub(rbtcUsed).add(stakeBalanceBefore)
//           ),
//           'Withdraw/unstake process have failed'
//         );

//         stakeInfo = await mockRelayHub.getStakeInfo(relayManager);
//         const stakeAfterWithdraw = toBN(stakeInfo.stake);

//         //Verifying there are no more stake balance for the manager
//         assert.isTrue(stakeAfterWithdraw.isZero(), 'Stake must be zero');

//         relayWorkersBefore = await mockRelayHub.workerCount(relayManager);
//         assert.equal(
//           relayWorkersBefore.toNumber(),
//           1,
//           `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
//         );

//         const calculatedAddr = await factory.getSmartWalletAddress(
//           gaslessAccount.address,
//           constants.ZERO_ADDRESS,
//           relayRequestMisbehavingVerifier.request.index
//         );
//         await token.mint('1', calculatedAddr);

//         await assert.isRejected(
//           mockRelayHub.deployCall(
//             relayRequestMisbehavingVerifier,
//             signatureWithMisbehavingVerifier,
//             { from: relayWorker, gas, gasPrice }
//           ),
//           'RelayManager not staked',
//           'Deploy was processed successfully'
//         );
//       });

//       it('Should fail when registering with no workers assigned to the Manager', async () => {
//         await mockRelayHub.stakeForAddress(relayManager, 1000, {
//           value: oneRBTC,
//           from: relayOwner,
//         });

//         const relayWorkersBefore = await mockRelayHub.workerCount(
//           relayManager
//         );
//         assert.equal(
//           relayWorkersBefore.toNumber(),
//           0,
//           `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
//         );

//         await assert.isRejected(
//           mockRelayHub.registerRelayServer(url, {
//             from: relayManager,
//           }),
//           'no relay workers',
//           'Relay Server was successfully registered'
//         );
//       });
//     });
//   }
// );
