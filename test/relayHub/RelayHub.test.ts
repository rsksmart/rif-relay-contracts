import { ether } from '@openzeppelin/test-helpers';
import {
    RelayRequest,
    cloneRelayRequest,
    DeployRequest,
    cloneDeployRequest,
    TypedRequestData,
    TypedDeployRequestData
} from '../../';

import {
    Environment,
    getLocalEip712Signature,
    stripHex,
    deployHub,
    getTestingEnvironment,
    createSmartWallet,
    getGaslessAccount,
    createSmartWalletFactory,
    evmMineMany,
    mintTokens,
    getTokenBalance
} from '../utils';

import { constants } from '../constants';

// @ts-ignore
import abiDecoder from 'abi-decoder';
import {
    RelayHubInstance,
    PenalizerInstance,
    TestRecipientInstance,
    IForwarderInstance,
    TestVerifierEverythingAcceptedInstance,
    SmartWalletInstance,
    SmartWalletFactoryInstance,
    TestTokenInstance,
    TestDeployVerifierConfigurableMisbehaviorInstance,
    TestDeployVerifierEverythingAcceptedInstance
} from '../../types/truffle-contracts';
import { toBN } from 'web3-utils';

import { use, assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

const SmartWallet = artifacts.require('SmartWallet');
const Penalizer = artifacts.require('Penalizer');
const TestVerifierEverythingAccepted = artifacts.require(
    'TestVerifierEverythingAccepted'
);
const TestDeployVerifierEverythingAccepted = artifacts.require(
    'TestDeployVerifierEverythingAccepted'
);
const TestRecipient = artifacts.require('TestRecipient');
const TestDeployVerifierConfigurableMisbehavior = artifacts.require(
    'TestDeployVerifierConfigurableMisbehavior'
);
const RelayHub = artifacts.require('RelayHub');
const IWalletFactory = artifacts.require('IWalletFactory');

// @ts-ignore
abiDecoder.addABI(TestRecipient.abi);
abiDecoder.addABI(IWalletFactory.abi);
abiDecoder.addABI(RelayHub.abi);

contract(
    'RelayHub contract - Worker related scenarios',
    ([relayOwner, relayManager, relayWorker, incorrectRelayManager]) => {
        let penalizer: PenalizerInstance;
        let relayHubInstance: RelayHubInstance;

        describe('Add/disable relay workers', function () {
            beforeEach(async () => {
                penalizer = await Penalizer.new();
                relayHubInstance = await deployHub(penalizer.address);
            });

            it('Should NOT register the same worker twice', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                //Getting the relay workers count before adding a new worker
                const relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    0,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                //Adding worker on the first time
                const txResponse = await relayHubInstance.addRelayWorkers(
                    [relayWorker],
                    { from: relayManager }
                );
                const receipt = await web3.eth.getTransactionReceipt(
                    txResponse.tx
                );
                const logs = abiDecoder.decodeLogs(receipt.logs);

                const relayWorkersAddedEvent = logs.find(
                    (e: any) => e != null && e.name === 'RelayWorkersAdded'
                );
                assert.equal(
                    relayManager.toLowerCase(),
                    relayWorkersAddedEvent.events[0].value.toLowerCase()
                );
                assert.equal(
                    relayWorker.toLowerCase(),
                    relayWorkersAddedEvent.events[1].value[0].toLowerCase()
                );
                assert.equal(toBN(1), relayWorkersAddedEvent.events[2].value);

                const relayWorkersAfter = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersAfter.toNumber(),
                    1,
                    'Workers must be one'
                );

                //Worker has associated the correct manager
                let manager = await relayHubInstance.workerToManager(
                    relayWorker
                );
                let expectedManager = '0x00000000000000000000000'.concat(
                    stripHex(relayManager.concat('1'))
                );
                assert.equal(
                    manager.toLowerCase(),
                    expectedManager.toLowerCase(),
                    `Incorrect relay manager: ${manager}`
                );

                //Adding same worker twice
                await assert.isRejected(
                    relayHubInstance.addRelayWorkers([relayWorker], {
                        from: relayManager
                    }),
                    'this worker has a manager',
                    'Worker was added twice'
                );

                //Asserting the manager is the same
                manager = await relayHubInstance.workerToManager(relayWorker);
                expectedManager = '0x00000000000000000000000'.concat(
                    stripHex(relayManager.concat('1'))
                );
                assert.equal(
                    manager.toLowerCase(),
                    expectedManager.toLowerCase(),
                    `Incorrect relay manager: ${manager}`
                );
            });

            it('Should NOT register the same worker for different managers', async function () {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                await relayHubInstance.stakeForAddress(
                    incorrectRelayManager,
                    1000,
                    {
                        value: ether('1'),
                        from: relayOwner
                    }
                );

                const relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    0,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                //Adding Worker
                let txResponse = await relayHubInstance.addRelayWorkers(
                    [relayWorker],
                    { from: relayManager }
                );
                let receipt = await web3.eth.getTransactionReceipt(
                    txResponse.tx
                );
                let logs = abiDecoder.decodeLogs(receipt.logs);

                const relayWorkersAddedEvent = logs.find(
                    (e: any) => e != null && e.name === 'RelayWorkersAdded'
                );
                assert.equal(
                    relayManager.toLowerCase(),
                    relayWorkersAddedEvent.events[0].value.toLowerCase()
                );
                assert.equal(
                    relayWorker.toLowerCase(),
                    relayWorkersAddedEvent.events[1].value[0].toLowerCase()
                );
                assert.equal(toBN(1), relayWorkersAddedEvent.events[2].value);

                const expectedManager = '0x00000000000000000000000'.concat(
                    stripHex(relayManager.concat('1'))
                );
                const manager = await relayHubInstance.workerToManager(
                    relayWorker
                );
                assert.equal(
                    manager.toLowerCase(),
                    expectedManager.toLowerCase(),
                    `Incorrect relay manager: ${manager}`
                );

                let relayWorkersAfter = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersAfter.toNumber(),
                    1,
                    'Workers must meet the Workers maximum value'
                );

                await assert.isRejected(
                    relayHubInstance.addRelayWorkers([relayWorker], {
                        from: incorrectRelayManager
                    }),
                    'this worker has a manager',
                    'Worker was assigned to two Managers'
                );

                txResponse = await relayHubInstance.disableRelayWorkers(
                    [relayWorker],
                    { from: relayManager }
                );

                receipt = await web3.eth.getTransactionReceipt(txResponse.tx);
                logs = abiDecoder.decodeLogs(receipt.logs);

                const relayWorkersDisabledEvent = logs.find(
                    (e: any) => e != null && e.name === 'RelayWorkersDisabled'
                );
                assert.equal(
                    relayManager.toLowerCase(),
                    relayWorkersDisabledEvent.events[0].value.toLowerCase()
                );
                assert.equal(
                    relayWorker.toLowerCase(),
                    relayWorkersDisabledEvent.events[1].value[0].toLowerCase()
                );
                assert.equal(
                    toBN(0),
                    relayWorkersDisabledEvent.events[2].value
                );

                relayWorkersAfter = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersAfter.toNumber(),
                    0,
                    'Workers must be zero'
                );

                await assert.isRejected(
                    relayHubInstance.addRelayWorkers([relayWorker], {
                        from: incorrectRelayManager
                    }),
                    'this worker has a manager',
                    'Worker was assigned to two Managers'
                );
            });

            it('Should be able to add and disable workers', async function () {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                const relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    0,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                let txResponse = await relayHubInstance.addRelayWorkers(
                    [relayWorker],
                    { from: relayManager }
                );
                let receipt = await web3.eth.getTransactionReceipt(
                    txResponse.tx
                );
                let logs = abiDecoder.decodeLogs(receipt.logs);

                const relayWorkersAddedEvent = logs.find(
                    (e: any) => e != null && e.name === 'RelayWorkersAdded'
                );
                assert.equal(
                    relayManager.toLowerCase(),
                    relayWorkersAddedEvent.events[0].value.toLowerCase()
                );
                assert.equal(
                    relayWorker.toLowerCase(),
                    relayWorkersAddedEvent.events[1].value[0].toLowerCase()
                );
                assert.equal(toBN(1), relayWorkersAddedEvent.events[2].value);

                let relayWorkersAfter = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersAfter.toNumber(),
                    1,
                    'Workers must be one'
                );

                let manager = await relayHubInstance.workerToManager(
                    relayWorker
                );

                let expectedManager = '0x00000000000000000000000'.concat(
                    stripHex(relayManager.concat('1'))
                );

                assert.equal(
                    manager.toLowerCase(),
                    expectedManager.toLowerCase(),
                    `Incorrect relay manager: ${manager}`
                );

                txResponse = await relayHubInstance.disableRelayWorkers(
                    [relayWorker],
                    { from: relayManager }
                );

                receipt = await web3.eth.getTransactionReceipt(txResponse.tx);
                logs = abiDecoder.decodeLogs(receipt.logs);
                const relayWorkersDisabledEvent = logs.find(
                    (e: any) => e != null && e.name === 'RelayWorkersDisabled'
                );
                assert.equal(
                    relayManager.toLowerCase(),
                    relayWorkersDisabledEvent.events[0].value.toLowerCase()
                );
                assert.equal(
                    relayWorker.toLowerCase(),
                    relayWorkersDisabledEvent.events[1].value[0].toLowerCase()
                );
                assert.equal(
                    toBN(0),
                    relayWorkersDisabledEvent.events[2].value
                );

                relayWorkersAfter = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersAfter.toNumber(),
                    0,
                    'Workers must be zero'
                );

                manager = await relayHubInstance.workerToManager(relayWorker);
                expectedManager = '0x00000000000000000000000'.concat(
                    stripHex(relayManager.concat('0'))
                );
                assert.equal(
                    manager.toLowerCase(),
                    expectedManager.toLowerCase(),
                    `Incorrect relay manager: ${manager}`
                );
            });

            it('Should NOT be able to add workers when Manager is unstaked', async function () {
                const relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    0,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                await assert.isRejected(
                    relayHubInstance.addRelayWorkers([relayWorker], {
                        from: relayManager
                    }),
                    'RelayManager not staked',
                    'Worker was successfully added'
                );
            });

            it('Should fail when adding too many workers', async function () {
                const maxWorkerCount = Number(
                    await relayHubInstance.maxWorkerCount()
                );

                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                const relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    0,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                //Adding Workers
                for (let i = 0; i < maxWorkerCount; i++) {
                    const workerAccount = web3.eth.accounts.create();
                    const workerId = i + 1;

                    const txResponse = await relayHubInstance.addRelayWorkers(
                        [workerAccount.address],
                        { from: relayManager }
                    );
                    const receipt = await web3.eth.getTransactionReceipt(
                        txResponse.tx
                    );
                    const logs = abiDecoder.decodeLogs(receipt.logs);

                    const relayWorkersAddedEvent = logs.find(
                        (e: any) => e != null && e.name === 'RelayWorkersAdded'
                    );
                    assert.equal(
                        relayManager.toLowerCase(),
                        relayWorkersAddedEvent.events[0].value.toLowerCase()
                    );
                    assert.equal(
                        workerAccount.address.toLowerCase(),
                        relayWorkersAddedEvent.events[1].value[0].toLowerCase()
                    );
                    assert.equal(
                        toBN(workerId),
                        relayWorkersAddedEvent.events[2].value
                    );

                    const expectedManager = '0x00000000000000000000000'.concat(
                        stripHex(relayManager.concat('1'))
                    );
                    const manager = await relayHubInstance.workerToManager(
                        workerAccount.address
                    );
                    assert.equal(
                        manager.toLowerCase(),
                        expectedManager.toLowerCase(),
                        `Incorrect relay manager: ${manager}`
                    );
                }

                const relayWorkersAfter = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersAfter.toNumber(),
                    maxWorkerCount,
                    'Workers must meet the Workers maximum value'
                );

                await assert.isRejected(
                    relayHubInstance.addRelayWorkers([relayWorker], {
                        from: relayManager
                    }),
                    'too many workers',
                    'More workers than maximum value were added'
                );
            });
        });
    }
);

contract(
    'RelayHub contract - Manager related scenarios',
    ([_, relayOwner, relayManager, relayWorker]) => {
        let chainId: number;
        let relayHub: string;
        let penalizer: PenalizerInstance;
        let relayHubInstance: RelayHubInstance;
        let recipientContract: TestRecipientInstance;
        let verifierContract: TestVerifierEverythingAcceptedInstance;
        let deployVerifierContract: TestDeployVerifierEverythingAcceptedInstance;
        let forwarderInstance: IForwarderInstance;
        let target: string;
        let verifier: string;
        let forwarder: string;
        let gaslessAccount;
        const gasLimit = '3000000';
        const gasPrice = '1';
        let sharedRelayRequestData: RelayRequest;
        let sharedDeployRequestData: DeployRequest;

        let env: Environment;
        let token: TestTokenInstance;
        let factory: SmartWalletFactoryInstance;
        let relayRequest: RelayRequest;

        let misbehavingVerifier: TestDeployVerifierConfigurableMisbehaviorInstance;
        let signatureWithMisbehavingVerifier: string;
        let relayRequestMisbehavingVerifier: DeployRequest;

        describe('Manager tests - Stake related scenarios', async () => {
            beforeEach(async function () {
                penalizer = await Penalizer.new();
                relayHubInstance = await deployHub(penalizer.address);
            });

            it('Should stake only from owner account', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });
                await assert.isRejected(
                    relayHubInstance.stakeForAddress(relayManager, 1000, {
                        value: ether('1'),
                        from: _
                    }),
                    'not owner',
                    'Stake was not made by the owner account'
                );
            });

            it('Should NOT be able to unauthorize/unstake a HUB and then perform a new stake with a worker', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.unlockStake(relayManager, {
                    from: relayOwner
                });

                //Verifying stake is now unlocked
                const stakeInfo = await relayHubInstance.getStakeInfo(
                    relayManager
                );
                const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
                assert.isTrue(isUnlocked, 'Stake is not unlocked');

                //Moving blocks to be able to unstake
                await evmMineMany(Number(stakeInfo.unstakeDelay));

                const gasPrice = toBN('60000000');
                await assert.isRejected(
                    relayHubInstance.withdrawStake(relayWorker, {
                        from: relayOwner,
                        gasPrice
                    }),
                    'not owner',
                    'Withdraw was made successfully'
                );
            });

            it('Should be able to unauthorize/unstake a HUB then stake should be ZERO', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.unlockStake(relayManager, {
                    from: relayOwner
                });

                //Verifying stake is now unlocked
                let stakeInfo = await relayHubInstance.getStakeInfo(
                    relayManager
                );
                const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
                assert.isTrue(isUnlocked, 'Stake is not unlocked');

                //Moving blocks to be able to unstake
                await evmMineMany(Number(stakeInfo.unstakeDelay));

                stakeInfo = await relayHubInstance.getStakeInfo(relayManager);
                const stakeBalanceBefore = toBN(stakeInfo.stake);

                const relayOwnerBalanceBefore = toBN(
                    await web3.eth.getBalance(relayOwner)
                );

                const gasPrice = toBN('60000000');
                const txResponse = await relayHubInstance.withdrawStake(
                    relayManager,
                    { from: relayOwner, gasPrice }
                );

                //Getting the gas used in order to calculate the original balance of the account
                const rbtcUsed = toBN(
                    (await web3.eth.getTransactionReceipt(txResponse.tx))
                        .cumulativeGasUsed
                ).mul(gasPrice);

                const relayOwnerBalanceAfter = toBN(
                    await web3.eth.getBalance(relayOwner)
                );
                assert.isTrue(
                    relayOwnerBalanceAfter.eq(
                        relayOwnerBalanceBefore
                            .sub(rbtcUsed)
                            .add(stakeBalanceBefore)
                    ),
                    'Withdraw/unstake process have failed'
                );

                stakeInfo = await relayHubInstance.getStakeInfo(relayManager);
                const stakeAfterWithdraw = toBN(stakeInfo.stake);

                //Verifying there are no more stake balance for the manager
                assert.isTrue(
                    stakeAfterWithdraw.isZero(),
                    'Stake must be zero'
                );
            });

            it('Should increment stake & replace stake delay when adding/performing a new stake for a manager', async () => {
                let stakeInfo = await relayHubInstance.getStakeInfo(
                    relayManager
                );
                assert.isTrue(
                    Number(stakeInfo.stake) === 0,
                    'Stakes is not ZERO'
                );

                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                stakeInfo = await relayHubInstance.getStakeInfo(relayManager);

                await assert.isRejected(
                    relayHubInstance.stakeForAddress(relayManager, 100, {
                        value: ether('10'),
                        from: relayOwner
                    }),
                    'unstakeDelay cannot be decreased',
                    'Stake was made properly'
                );

                await relayHubInstance.stakeForAddress(relayManager, 2000, {
                    value: ether('10'),
                    from: relayOwner
                });

                stakeInfo = await relayHubInstance.getStakeInfo(relayManager);

                assert.strictEqual(
                    stakeInfo.unstakeDelay,
                    '2000',
                    'Unstake delay was not replaced'
                );
                assert.isTrue(
                    stakeInfo.stake === '11000000000000000000',
                    'Stakes were not added properly'
                );
            });

            it('Should NOT be able to unauthorize/unstake a HUB before reaching the delay blocks minimum', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                //Adding a new worker to the manager
                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.workerToManager(relayWorker);

                const gasPrice = toBN('60000000');
                await assert.isRejected(
                    relayHubInstance.withdrawStake(relayManager, {
                        from: relayOwner,
                        gasPrice
                    }),
                    'Withdrawal is not scheduled',
                    'Withdrawal was completed'
                );

                await relayHubInstance.unlockStake(relayManager, {
                    from: relayOwner
                });
                await assert.isRejected(
                    relayHubInstance.withdrawStake(relayManager, {
                        from: relayOwner,
                        gasPrice
                    }),
                    'Withdrawal is not due',
                    'Withdrawal was completed'
                );
            });

            it('Should fail when staking Manager and Owner account are the same when staking', async () => {
                await assert.isRejected(
                    relayHubInstance.stakeForAddress(relayManager, 1000, {
                        value: ether('1'),
                        from: relayManager
                    }),
                    'caller is the relayManager',
                    'Stake for manager was made with manager account as owner'
                );
            });

            it('Should fail when stake is less than minimum stake value', async () => {
                await assert.isRejected(
                    relayHubInstance.stakeForAddress(relayManager, 1000, {
                        value: ether('0.0005'),
                        from: relayOwner
                    }),
                    'Insufficient intitial stake',
                    'Stake was made with less value than the minimum'
                );
            });

            it('Should fail when sender is a RelayManager', async () => {
                relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                const stakeInfo = await relayHubInstance.getStakeInfo(
                    relayManager
                );

                assert.equal(
                    stakeInfo.owner,
                    constants.ZERO_ADDRESS,
                    'sender is a relayManager itself'
                );

                await assert.isRejected(
                    relayHubInstance.stakeForAddress(_, 1000, {
                        value: ether('1'),
                        from: relayManager
                    }),
                    'sender is a relayManager itself',
                    'Stake was made with proper relayManager'
                );
            });
        });

        describe('Manager - RelayRequest scenarios', async () => {
            let signature: string;
            const gas = 4e6;

            beforeEach(async () => {
                env = await getTestingEnvironment();
                chainId = env.chainId;

                penalizer = await Penalizer.new();
                relayHubInstance = await deployHub(penalizer.address);

                const smartWalletTemplate: SmartWalletInstance =
                    await SmartWallet.new();
                factory = await createSmartWalletFactory(smartWalletTemplate);

                recipientContract = await TestRecipient.new();
                verifierContract = await TestVerifierEverythingAccepted.new();
                deployVerifierContract =
                    await TestDeployVerifierEverythingAccepted.new();

                const testToken = artifacts.require('TestToken');
                token = await testToken.new();

                target = recipientContract.address;
                verifier = verifierContract.address;
                relayHub = relayHubInstance.address;

                gaslessAccount = await getGaslessAccount();
                forwarderInstance = await createSmartWallet(
                    _,
                    gaslessAccount.address,
                    factory,
                    gaslessAccount.privateKey,
                    chainId
                );
                forwarder = forwarderInstance.address;
                await token.mint('1000', forwarder);

                sharedRelayRequestData = {
                    request: {
                        relayHub: relayHub,
                        to: target,
                        data: '',
                        from: gaslessAccount.address,
                        nonce: (await forwarderInstance.nonce()).toString(),
                        value: '0',
                        gas: gasLimit,
                        tokenContract: token.address,
                        tokenAmount: '1',
                        tokenGas: '50000'
                    },
                    relayData: {
                        gasPrice,
                        feesReceiver: relayWorker,
                        callForwarder: forwarder,
                        callVerifier: verifier
                    }
                };

                relayRequest = cloneRelayRequest(sharedRelayRequestData);
                relayRequest.request.data = '0xdeadbeef';

                const dataToSign = new TypedRequestData(
                    chainId,
                    forwarder,
                    relayRequest
                );
                signature = getLocalEip712Signature(
                    dataToSign,
                    gaslessAccount.privateKey
                );
            });

            it('Should fail a relayRequest if the manager is unstaked', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                let relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    0,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.workerToManager(relayWorker);

                await relayHubInstance.unlockStake(relayManager, {
                    from: relayOwner
                });

                //Verifying stake is now unlocked
                let stakeInfo = await relayHubInstance.getStakeInfo(
                    relayManager
                );
                const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
                assert.isTrue(isUnlocked, 'Stake is not unlocked');

                //Moving blocks to be able to unstake
                await evmMineMany(Number(stakeInfo.unstakeDelay));

                stakeInfo = await relayHubInstance.getStakeInfo(relayManager);
                const stakeBalanceBefore = toBN(stakeInfo.stake);

                const relayOwnerBalanceBefore = toBN(
                    await web3.eth.getBalance(relayOwner)
                );

                const gasPrice = toBN('60000000');
                const txResponse = await relayHubInstance.withdrawStake(
                    relayManager,
                    { from: relayOwner, gasPrice }
                );

                //Getting the gas used in order to calculate the original balance of the account
                const rbtcUsed = toBN(
                    (await web3.eth.getTransactionReceipt(txResponse.tx))
                        .cumulativeGasUsed
                ).mul(gasPrice);

                const relayOwnerBalanceAfter = toBN(
                    await web3.eth.getBalance(relayOwner)
                );
                assert.isTrue(
                    relayOwnerBalanceAfter.eq(
                        relayOwnerBalanceBefore
                            .sub(rbtcUsed)
                            .add(stakeBalanceBefore)
                    ),
                    'Withdraw/unstake process have failed'
                );

                stakeInfo = await relayHubInstance.getStakeInfo(relayManager);
                const stakeAfterWithdraw = toBN(stakeInfo.stake);

                //Verifying there are no more stake balance for the manager
                assert.isTrue(
                    stakeAfterWithdraw.isZero(),
                    'Stake must be zero'
                );

                relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    1,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                await assert.isRejected(
                    relayHubInstance.relayCall(relayRequest, signature, {
                        from: relayWorker,
                        gas
                    }),
                    'RelayManager not staked',
                    'Relay request was properly processed'
                );
            });

            it('Should fail a relayRequest if the manager is in the last block of delay blocks', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.workerToManager(relayWorker);

                await relayHubInstance.unlockStake(relayManager, {
                    from: relayOwner
                });

                await assert.isRejected(
                    relayHubInstance.relayCall(relayRequest, signature, {
                        from: relayWorker,
                        gas
                    }),
                    'RelayManager not staked',
                    'Relay request was properly processed'
                );
            });

            it('Should success a relayRequest without paying fee', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.workerToManager(relayWorker);

                const result = relayHubInstance.relayCall(
                    relayRequest,
                    signature,
                    { from: relayWorker }
                );
                await assert.isFulfilled(result);
            });

            it('Should success a relayRequest paying fee', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.workerToManager(relayWorker);

                const fee = '1';

                relayRequest.request.tokenAmount = fee;

                await mintTokens(
                    token,
                    relayRequest.relayData.callForwarder,
                    fee
                );

                const workerBefore = await getTokenBalance(token, relayWorker);
                assert.equal(workerBefore.toString(), '0');

                const result = relayHubInstance.relayCall(
                    relayRequest,
                    signature,
                    { from: relayWorker, gas }
                );
                await assert.isFulfilled(result);

                const workerAfter = await getTokenBalance(token, relayWorker);

                assert.equal(workerAfter.toString(), fee.toString());
            });
        });

        describe('Manager - DeployRequest scenarios', async () => {
            let min = 0;
            let max = 1000000000;
            min = Math.ceil(min);
            max = Math.floor(max);
            let nextWalletIndex = Math.floor(
                Math.random() * (max - min + 1) + min
            );

            const gas = 4e6;
            const url = 'http://relay.com';
            let deployRequest: DeployRequest;

            beforeEach(async () => {
                env = await getTestingEnvironment();
                chainId = env.chainId;

                penalizer = await Penalizer.new();
                relayHubInstance = await deployHub(penalizer.address);
                verifierContract = await TestVerifierEverythingAccepted.new();
                deployVerifierContract =
                    await TestDeployVerifierEverythingAccepted.new();
                gaslessAccount = await getGaslessAccount();

                const smartWalletTemplate: SmartWalletInstance =
                    await SmartWallet.new();
                factory = await createSmartWalletFactory(smartWalletTemplate);
                recipientContract = await TestRecipient.new();

                const testToken = artifacts.require('TestToken');
                token = await testToken.new();

                target = recipientContract.address;
                verifier = verifierContract.address;
                relayHub = relayHubInstance.address;

                sharedDeployRequestData = {
                    request: {
                        relayHub: relayHub,
                        to: constants.ZERO_ADDRESS,
                        data: '0x',
                        from: gaslessAccount.address,
                        nonce: (
                            await factory.nonce(gaslessAccount.address)
                        ).toString(),
                        value: '0',
                        tokenContract: token.address,
                        tokenAmount: '1',
                        tokenGas: '50000',
                        recoverer: constants.ZERO_ADDRESS,
                        index: '0'
                    },
                    relayData: {
                        gasPrice,
                        feesReceiver: relayWorker,
                        callForwarder: factory.address,
                        callVerifier: deployVerifierContract.address
                    }
                };

                deployRequest = cloneDeployRequest(sharedDeployRequestData);
                deployRequest.request.index = nextWalletIndex.toString();
                misbehavingVerifier =
                    await TestDeployVerifierConfigurableMisbehavior.new();
                deployRequest.request.index = nextWalletIndex.toString();
                nextWalletIndex++;

                relayRequestMisbehavingVerifier =
                    cloneDeployRequest(deployRequest);
                relayRequestMisbehavingVerifier.relayData.callVerifier =
                    misbehavingVerifier.address;

                const dataToSign = new TypedDeployRequestData(
                    chainId,
                    factory.address,
                    relayRequestMisbehavingVerifier
                );
                signatureWithMisbehavingVerifier = getLocalEip712Signature(
                    dataToSign,
                    gaslessAccount.privateKey
                );
            });

            it('Should fail a deployRequest if SmartWallet has already been initialized', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('2'),
                    from: relayOwner
                });
                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.registerRelayServer(url, {
                    from: relayManager
                });

                const smartWalletTemplate: SmartWalletInstance =
                    await SmartWallet.new();
                const senderAccount = web3.eth.accounts.create();

                smartWalletTemplate.initialize(
                    senderAccount.address,
                    token.address,
                    relayWorker,
                    '0',
                    '400000'
                );
                factory = await createSmartWalletFactory(smartWalletTemplate);

                const calculatedAddr = await factory.getSmartWalletAddress(
                    gaslessAccount.address,
                    constants.ZERO_ADDRESS,
                    relayRequestMisbehavingVerifier.request.index
                );
                await token.mint('1', calculatedAddr);

                await assert.isRejected(
                    relayHubInstance.deployCall(
                        relayRequestMisbehavingVerifier,
                        signatureWithMisbehavingVerifier,
                        { from: relayWorker, gas, gasPrice }
                    ),
                    'Unable to initialize SW',
                    'SW was deployed and initialized'
                );
            });

            it('Should fail a deployRequest if Manager is unstaked', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                let relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    0,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.workerToManager(relayWorker);

                await relayHubInstance.unlockStake(relayManager, {
                    from: relayOwner
                });

                //Verifying stake is now unlocked
                let stakeInfo = await relayHubInstance.getStakeInfo(
                    relayManager
                );

                //Moving blocks to be able to unstake
                await evmMineMany(Number(stakeInfo.unstakeDelay));

                stakeInfo = await relayHubInstance.getStakeInfo(relayManager);
                const stakeBalanceBefore = toBN(stakeInfo.stake);

                const relayOwnerBalanceBefore = toBN(
                    await web3.eth.getBalance(relayOwner)
                );

                const gasPrice = toBN('60000000');
                const txResponse = await relayHubInstance.withdrawStake(
                    relayManager,
                    { from: relayOwner, gasPrice }
                );

                //Getting the gas used in order to calculate the original balance of the account
                const rbtcUsed = toBN(
                    (await web3.eth.getTransactionReceipt(txResponse.tx))
                        .cumulativeGasUsed
                ).mul(gasPrice);

                const relayOwnerBalanceAfter = toBN(
                    await web3.eth.getBalance(relayOwner)
                );
                assert.isTrue(
                    relayOwnerBalanceAfter.eq(
                        relayOwnerBalanceBefore
                            .sub(rbtcUsed)
                            .add(stakeBalanceBefore)
                    ),
                    'Withdraw/unstake process have failed'
                );

                stakeInfo = await relayHubInstance.getStakeInfo(relayManager);
                const stakeAfterWithdraw = toBN(stakeInfo.stake);

                //Verifying there are no more stake balance for the manager
                assert.isTrue(
                    stakeAfterWithdraw.isZero(),
                    'Stake must be zero'
                );

                relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    1,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                const calculatedAddr = await factory.getSmartWalletAddress(
                    gaslessAccount.address,
                    constants.ZERO_ADDRESS,
                    relayRequestMisbehavingVerifier.request.index
                );
                await token.mint('1', calculatedAddr);

                await assert.isRejected(
                    relayHubInstance.deployCall(
                        relayRequestMisbehavingVerifier,
                        signatureWithMisbehavingVerifier,
                        { from: relayWorker, gas, gasPrice }
                    ),
                    'RelayManager not staked',
                    'Deploy was processed successfully'
                );
            });

            it('Should success a deployRequest without paying fee', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.workerToManager(relayWorker);

                deployRequest.request.tokenAmount = '0';

                const dataToSign = new TypedDeployRequestData(
                    chainId,
                    factory.address,
                    deployRequest
                );
                const signature = getLocalEip712Signature(
                    dataToSign,
                    gaslessAccount.privateKey
                );

                const result = relayHubInstance.deployCall(
                    deployRequest,
                    signature,
                    { from: relayWorker }
                );
                await assert.isFulfilled(result);
            });

            it('Should success a deployRequest paying fee', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                await relayHubInstance.addRelayWorkers([relayWorker], {
                    from: relayManager
                });
                await relayHubInstance.workerToManager(relayWorker);

                const fee = '1';

                deployRequest.request.tokenAmount = fee;

                const calculatedAddr = await factory.getSmartWalletAddress(
                    gaslessAccount.address,
                    constants.ZERO_ADDRESS,
                    deployRequest.request.index
                );

                await mintTokens(token, calculatedAddr, fee);

                const dataToSign = new TypedDeployRequestData(
                    chainId,
                    factory.address,
                    deployRequest
                );
                const signature = getLocalEip712Signature(
                    dataToSign,
                    gaslessAccount.privateKey
                );

                const workerBefore = await getTokenBalance(token, relayWorker);
                assert.equal(workerBefore.toString(), '0');

                const result = relayHubInstance.deployCall(
                    deployRequest,
                    signature,
                    { from: relayWorker, gas }
                );
                await assert.isFulfilled(result);

                const workerAfter = await getTokenBalance(token, relayWorker);

                assert.equal(workerAfter.toString(), fee.toString());
            });

            it('Should fail when registering with no workers assigned to the Manager', async () => {
                await relayHubInstance.stakeForAddress(relayManager, 1000, {
                    value: ether('1'),
                    from: relayOwner
                });

                const relayWorkersBefore = await relayHubInstance.workerCount(
                    relayManager
                );
                assert.equal(
                    relayWorkersBefore.toNumber(),
                    0,
                    `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
                );

                await assert.isRejected(
                    relayHubInstance.registerRelayServer(url, {
                        from: relayManager
                    }),
                    'no relay workers',
                    'Relay Server was successfully registered'
                );
            });
        });
    }
);
