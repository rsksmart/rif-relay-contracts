import {Environment, ERR_NOT_OWNER, ERR_UNSTAKED, getTestingEnvironment, oneRBTC} from "../utils";
import chai, {assert, expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {mine} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {FakeContract, MockContract, smock} from "@defi-wonderland/smock";
import {Penalizer, RelayHub, SmartWallet, SmartWalletFactory} from "../../typechain-types";
import {IForwarderInterface} from "../../typechain-types/contracts/interfaces/IForwarder";
import {createContractDeployer} from "./utils";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {IForwarder} from "../../typechain-types/contracts/RelayHub";
import DeployRequestStruct = IForwarder.DeployRequestStruct;
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  getLocalEip712Signature,
  TypedRequestData,
  RelayRequest,
  ForwardRequest,
  RelayData} from '../utils/EIP712Utils';
import {SignTypedDataVersion, TypedDataUtils} from "@metamask/eth-sig-util";
import {Wallet} from "ethers";

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = ethers.constants.AddressZero ;

describe('RelayHub contract - Manager related scenarios', function () {
  let deployRelayHubContract: ReturnType<typeof createContractDeployer>;
  let relayManager: SignerWithAddress, relayManagerAddr: string;
  let relayWorker: SignerWithAddress, relayWorkerAddr: string;
  let relayOwner: SignerWithAddress, relayOwnerAddr: string;
  let otherUsers: SignerWithAddress[];

  let fakePenalizer: FakeContract<Penalizer>;
  let mockRelayHub: MockContract<RelayHub>;

  let chainId: number;

  beforeEach(async function () {
    [relayOwner, relayManager, relayWorker, ...otherUsers] = await ethers.getSigners();
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

  describe('Manager tests - Stake related scenarios', async () => {
    beforeEach(async function () {
      deployRelayHubContract = createContractDeployer(fakePenalizer.address);
    });

    it('Should stake only from owner account', async () => {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });
      const [anotherRelayManager] = otherUsers;
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

    it('Should NOT be able to unauthorize/unstake a HUB and then perform a new stake with a worker', async () => {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      await mockRelayHub.connect(relayManager).addRelayWorkers([relayWorkerAddr], {
        from: relayManagerAddr,
      });
      await mockRelayHub.unlockStake(relayManagerAddr, {
        from: relayOwnerAddr,
      });

      //Verifying stake is now unlocked
      const stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
      assert.isTrue(isUnlocked, 'Stake is not unlocked');

      //Moving blocks to be able to unstake
      await mine(Number(stakeInfo.unstakeDelay));

      const gasPrice = ethers.BigNumber.from('60000000');
      await assert.isRejected(
        mockRelayHub.withdrawStake(relayWorkerAddr, {
          from: relayOwnerAddr,
          gasPrice,
        }),
        ERR_NOT_OWNER,
        'Withdraw was made successfully'
      );
    });

    it('Should be able to unauthorize/unstake a HUB then stake should be ZERO', async () => {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      await mockRelayHub.connect(relayManager).addRelayWorkers([relayWorkerAddr], {
        from: relayManagerAddr,
      });

      await mockRelayHub.unlockStake(relayManagerAddr, {
        from: relayOwnerAddr,
      });

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

      const gasPrice = ethers.BigNumber.from('60000000');
      const txResponse = await mockRelayHub.withdrawStake(relayManagerAddr, {
        from: relayOwnerAddr,
        gasPrice,
      });

      //Getting the gas used in order to calculate the original balance of the account
      const txReceipt = await ethers.provider.getTransactionReceipt(txResponse.hash);
      const rbtcUsed = ethers.BigNumber.from(txReceipt.cumulativeGasUsed).mul(gasPrice);

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

    it('Should increment stake & replace stake delay when adding/performing a new stake for a manager', async () => {
      let stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      assert.isTrue(Number(stakeInfo.stake) === 0, 'Stakes is not ZERO');

      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);

      await assert.isRejected(
        mockRelayHub.stakeForAddress(relayManagerAddr, 100, {
          value: ethers.BigNumber.from('10'),
          from: relayOwnerAddr,
        }),
        'unstakeDelay cannot be decreased',
        'Stake was made properly'
      );

      await mockRelayHub.stakeForAddress(relayManagerAddr, 2000, {
        value: '10000000000000000000',
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

    it('Should NOT be able to unauthorize/unstake a HUB before reaching the delay blocks minimum', async () => {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      //Adding a new worker to the manager
      await mockRelayHub.connect(relayManager).addRelayWorkers([relayWorkerAddr], {
        from: relayManagerAddr,
      });
      await mockRelayHub.workerToManager(relayWorkerAddr);

      const gasPrice = ethers.BigNumber.from('60000000');
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

    it('Should fail when staking Manager and Owner account are the same when staking', async () => {
      await assert.isRejected(
        mockRelayHub.connect(relayManager).stakeForAddress(relayManagerAddr, 1000, {
          value: oneRBTC,
          from: relayManagerAddr,
        }),
        'caller is the relayManager',
        'Stake for manager was made with manager account as owner'
      );
    });

    it('Should fail when stake is less than minimum stake value', async () => {
      await assert.isRejected(
        mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
          value: ethers.BigNumber.from("0"),
          from: relayOwnerAddr,
        }),
        'Insufficient intitial stake',
        'Stake was made with less value than the minimum'
      );
    });

    it('Should fail when sender is a RelayManager', async () => {
      mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });


      const [anotherRelayManager] = otherUsers;
      await assert.isRejected(
        mockRelayHub.connect(relayManager).stakeForAddress(anotherRelayManager.address, 1000, {
          value: oneRBTC,
          from: relayManagerAddr,
        }),
        'sender is a relayManager itself',
        'Stake was made with less value than the minimum'
      );
    });
  });

  describe.only('Manager - RelayRequest scenarios', async () => {


    const HARDHAT_CHAIN_ID = 31337;
    const ONE_FIELD_IN_BYTES = 32;
    const FAKE_PRIVATE_KEY = 'da1294b386f1c04cd3276ef3298ef122f226472a55f241d22f924bdc19f92379';
    let token: FakeContract;
    let smartWallet: SmartWallet;
    let worker: SignerWithAddress;
    let externalWallet: Wallet;

    async function prepareFixture(){
      const smartWalletFactory = await ethers.getContractFactory('SmartWallet');
      const smartWallet = await smartWalletFactory.deploy();
      const [owner, worker, utilSigner] = await ethers.getSigners();

      return {smartWallet, owner, worker, utilSigner};
    }

    function createRequest(
      request: Partial<ForwardRequest>,
      relayData: Partial<RelayData>
    ): RelayRequest {
      const baseRequest: RelayRequest = {
        request:{
          relayHub: ZERO_ADDRESS,
          from: ZERO_ADDRESS,
          to: ZERO_ADDRESS,
          tokenContract: ZERO_ADDRESS,
          value: '0',
          gas: '10000',
          nonce: '0',
          tokenAmount: '1',
          tokenGas: '50000',
          data: '0x'
        } as ForwardRequest,
        relayData:{
          gasPrice: '1',
          relayWorker: ZERO_ADDRESS,
          callForwarder: ZERO_ADDRESS,
          callVerifier: ZERO_ADDRESS
        } as RelayData
      } as RelayRequest

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

    function getSuffixData(typedRequestData: TypedRequestData):string{
      const encoded =TypedDataUtils.encodeData(
        typedRequestData.primaryType,
        typedRequestData.message,
        typedRequestData.types,
        SignTypedDataVersion.V4
      );

      const messageSize = Object.keys(typedRequestData.message).length;

      return '0x'+(encoded.slice(messageSize * ONE_FIELD_IN_BYTES)).toString('hex');
    }


    beforeEach(async () => {
      mockRelayHub = await deployRelayHubContract();
      token = await smock.fake('ERC20');
      token.transfer.returns(true);

      ({smartWallet, worker} = await loadFixture(prepareFixture));
      externalWallet =  ethers.Wallet.createRandom();
      externalWallet.connect(ethers.provider);

      await smartWallet.initialize(externalWallet.address, token.address, worker.address, 10, 400000);
    });

    afterEach(function () {
      mockRelayHub = undefined as unknown as MockContract<RelayHub>;
      token = undefined as unknown as FakeContract;
      smartWallet = undefined as unknown as SmartWallet;
      externalWallet = undefined as unknown as Wallet;
    });


    it('Should fail a relayRequest if the manager is in the last block of delay blocks', async () => {

      const {smartWallet} = await loadFixture(prepareFixture);

      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      await mockRelayHub.connect(relayManager).addRelayWorkers([relayWorkerAddr]);
      await mockRelayHub.workerToManager(relayWorkerAddr);

      await mockRelayHub.unlockStake(relayManagerAddr, {
        from: relayOwnerAddr,
      });

      const relayRequest = createRequest({
        from: externalWallet.address,
        tokenContract: token.address,
        relayHub: mockRelayHub.address,
        tokenAmount: '1',
        tokenGas: '50000'
      },{
        relayWorker: relayWorkerAddr
      });

      const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);

      const privateKey = Buffer.from(externalWallet.privateKey.substring(2, 66), 'hex');

      const signature = getLocalEip712Signature(typedRequestData, privateKey);
      //
      mockRelayHub = await mockRelayHub.connect(relayWorker);
      // const result =  await assert.isRejected(
      //     mockRelayHub.relayCall(relayRequest, signature),
      //     ERR_UNSTAKED,
      //     'Relay request was properly processed'
      // );
      await expect(
        mockRelayHub.relayCall(relayRequest, signature)
      ).to.be.rejectedWith(
          ERR_UNSTAKED
      );
    });

    it('Should fail a relayRequest if the manager is unstaked', async () => {
      console.log('test1')
      // const {smartWallet} = await loadFixture(prepareFixture);
      console.log(relayManagerAddr);
      console.log(oneRBTC.toString());
      console.log(relayOwnerAddr);
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr
      });

      let relayWorkersBefore = await mockRelayHub.workerCount(
        relayManagerAddr
      );

      assert.equal(
        relayWorkersBefore.toNumber(),
        0,
        `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
      );

      await mockRelayHub.connect(relayManager).addRelayWorkers([relayWorkerAddr], {
        from: relayManagerAddr,
      });
      await mockRelayHub.workerToManager(relayWorkerAddr);

      await mockRelayHub.unlockStake(relayManagerAddr, {
        from: relayOwnerAddr,
      });

      //Verifying stake is now unlocked
      let stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      console.log(stakeInfo);
      const isUnlocked = Number(stakeInfo.withdrawBlock) > 0;
      assert.isTrue(isUnlocked, 'Stake is not unlocked');

      //Moving blocks to be able to unstake
      console.log('TESTESTSETEWST');
      await mine(Number(stakeInfo.unstakeDelay));
      // await ethers.provider.send("evm_increaseTime", [Number(stakeInfo.unstakeDelay)]);
      // await ethers.provider.send("evm_mine", []);

      // stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      // const stakeBalanceBefore = ethers.BigNumber.from(stakeInfo.stake);
      //
      // const relayOwnerBalanceBefore = ethers.BigNumber.from(
      //   await ethers.provider.getBalance(relayOwnerAddr)
      // );
      //
      // const txResponse = await mockRelayHub.withdrawStake(relayManagerAddr, {
      //   from: relayOwnerAddr,
      // });
      //
      // //Getting the gas used in order to calculate the original balance of the account
      //
      // const txReceipt = await ethers.provider.getTransactionReceipt(txResponse.hash);
      // const rbtcUsed = ethers.BigNumber.from(txReceipt.cumulativeGasUsed).mul(gasPrice);
      //
      // const relayOwnerBalanceAfter = ethers.BigNumber.from(
      //   await ethers.provider.getBalance(relayOwnerAddr)
      // );
      // assert.isTrue(
      //   relayOwnerBalanceAfter.eq(
      //     relayOwnerBalanceBefore.sub(rbtcUsed).add(stakeBalanceBefore)
      //   ),
      //   'Withdraw/unstake process have failed'
      // );
      //
      // stakeInfo = await mockRelayHub.getStakeInfo(relayManagerAddr);
      // const stakeAfterWithdraw = ethers.BigNumber.from(stakeInfo.stake);
      //
      // //Verifying there are no more stake balance for the manager
      // assert.isTrue(stakeAfterWithdraw.isZero(), 'Stake must be zero');
      //
      // relayWorkersBefore = await mockRelayHub.workerCount(relayManagerAddr);
      // assert.equal(
      //   relayWorkersBefore.toNumber(),
      //   1,
      //   `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
      // );
      //
      // const relayRequest = createRequest({
      //   from: externalWallet.address,
      //   tokenContract: token.address,
      //   relayHub: mockRelayHub.address,
      //   tokenAmount: '1',
      //   tokenGas: '60000000'
      // },{
      //   relayWorker: relayWorkerAddr
      // });
      //
      // relayRequest.request.data = '0xdeadbeef';
      //
      // const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, smartWallet.address, relayRequest);
      //
      // const privateKey = Buffer.from(externalWallet.privateKey.substring(2, 66), 'hex');
      //
      // const signature = getLocalEip712Signature(typedRequestData, privateKey);
      //
      // // const suffixData = getSuffixData(typedRequestData);
      //
      // const [anotherRelayManager] = otherUsers;
      //
      // let new_worker = await mockRelayHub.connect(relayWorker);
      // await assert.isRejected(
      //   new_worker.relayCall(relayRequest, signature),
      //   ERR_UNSTAKED,
      //   'Relay request was properly processed'
      // );
    });

  });

  describe('Manager - DeployRequest scenarios', async () => {
    let min = 0;
    let max = 1000000000;
    min = Math.ceil(min);
    max = Math.floor(max);
    let nextWalletIndex = Math.floor(Math.random() * (max - min + 1) + min);

    const gas = 4e6;
    const url = 'http://relay.com';
//       let deployRequest: DeployRequest;


    const HARDHAT_CHAIN_ID = 31337;
    const ONE_FIELD_IN_BYTES = 32;
    const FAKE_PRIVATE_KEY = 'da1294b386f1c04cd3276ef3298ef122f226472a55f241d22f924bdc19f92379';
    let token: FakeContract;
    let smartWallet: SmartWallet;
    let worker: SignerWithAddress;
    let externalWallet: Wallet;

    async function prepareFixture(){
      const smartWalletFactory =await ethers.getContractFactory('SmartWallet');
      const smartWallet = await smartWalletFactory.deploy();
      const [owner, worker, utilSigner] = await ethers.getSigners();

      return {smartWallet, owner, worker, utilSigner};
    }

    function createRequest(
      request: Partial<ForwardRequest>,
      relayData: Partial<RelayData>
    ): RelayRequest {
      const baseRequest: RelayRequest = {
        request:{
          relayHub: ZERO_ADDRESS,
          from: ZERO_ADDRESS,
          to: ZERO_ADDRESS,
          tokenContract: ZERO_ADDRESS,
          value: '0',
          gas: '10000',
          nonce: '0',
          tokenAmount: '1',
          tokenGas: '50000',
          data: '0x'
        } as ForwardRequest,
        relayData:{
          gasPrice: '1',
          relayWorker: ZERO_ADDRESS,
          callForwarder: ZERO_ADDRESS,
          callVerifier: ZERO_ADDRESS
        } as RelayData
      } as RelayRequest

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

    function getSuffixData(typedRequestData: TypedRequestData):string{
      const encoded =TypedDataUtils.encodeData(
        typedRequestData.primaryType,
        typedRequestData.message,
        typedRequestData.types,
        SignTypedDataVersion.V4
      );

      const messageSize = Object.keys(typedRequestData.message).length;

      return '0x'+(encoded.slice(messageSize * ONE_FIELD_IN_BYTES)).toString('hex');
    }

    beforeEach(async () => {
      let env = await getTestingEnvironment();

      token = await smock.fake('ERC20');
      token.transfer.returns(true);
      chainId = env.chainId;

//         penalizer = await Penalizer.new();
//         mockRelayHub = await deployHub(penalizer.address);
//         verifierContract = await TestVerifierEverythingAccepted.new();
//         deployVerifierContract =
//           await TestDeployVerifierEverythingAccepted.new();
      const gaslessAccount = ethers.Wallet.createRandom().connect(ethers.provider);

      // const smartWalletTemplate: SmartWallet = await SmartWallet.new();
      // factory = await createSmartWalletFactory(smartWalletTemplate);
//         recipientContract = await TestRecipient.new();

//         const testToken = artifacts.require('TestToken');
//         token = await testToken.new();

//         target = recipientContract.address;
//         verifier = verifierContract.address;
//         relayHub = mockRelayHub.address;


      let sharedDeployRequestData = {
        request: {
          relayHub: mockRelayHub,
          to: '0x000000000000000000000000000000',
          data: '0x',
          from: relayOwnerAddr,
          nonce: 330799,
          value: '0',
          tokenContract: token.address,
          tokenAmount: '1',
          tokenGas: '50000',
          recoverer: '0x000000000000000000000000000000',
          index: '0',
        },
        relayData: {
          gas,
          relayWorker,
          callForwarder: null,
          callVerifier: null,
          domainSeparator: null,
        },
      };

      let deployRequest = {
        request: {...sharedDeployRequestData.request},
        relayData: {...sharedDeployRequestData.relayData}
      };
      deployRequest.request.index = nextWalletIndex.toString();
//         misbehavingVerifier =
//           await TestDeployVerifierConfigurableMisbehavior.new();
      deployRequest.request.index = nextWalletIndex.toString();
      nextWalletIndex++;

      let relayRequestMisbehavingVerifier = {
        request: {...deployRequest.request},
        relayData: {...deployRequest.relayData}
      };
      relayRequestMisbehavingVerifier.relayData.callVerifier = null;
      // misbehavingVerifier.address;

      // const dataToSign = new TypedDeployRequestData(
      //   chainId,
      //   factory.address,
      //   relayRequestMisbehavingVerifier
      // );
//         signatureWithMisbehavingVerifier = getLocalEip712Signature(
//           dataToSign,
//           gaslessAccount.privateKey
//         );
    });

    afterEach(function () {
      mockRelayHub = undefined as unknown as MockContract<RelayHub>;
    });

    it('Should failed a deployRequest if SmartWallet has already been initialized', async () => {

      const {smartWallet} = await loadFixture(prepareFixture);

      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      await mockRelayHub.connect(relayManager).addRelayWorkers([relayWorkerAddr]);
      await mockRelayHub.connect(relayManager).registerRelayServer(url);

      // const smartWalletTemplate: SmartWalletInstance = await SmartWallet.new();
      const senderAccount = ethers.Wallet.createRandom().connect(ethers.provider);

      // smartWalletTemplate.initialize(
      //   senderAccount.address,
      //   token.address,
      //   relayWorker,
      //   '0',
      //   '400000'
      // );
//         factory = await createSmartWalletFactory(smartWalletTemplate);

      const smartWalletFactory =await ethers.getContractFactory('SmartWallet');
        let calculatedAddr: SmartWallet = await smartWalletFactory.deploy();
        // const calculatedAddr = await factory.getSmartWalletAddress(
//           gaslessAccount.address,
//           constants.ZERO_ADDRESS,
//           relayRequestMisbehavingVerifier.request.index
//         );
        await token.mint('1', calculatedAddr.address);

      // await assert.isRejected(
      //     mockRelayHub.deployCall(
      //         relayRequestMisbehavingVerifier,
      //         signatureWithMisbehavingVerifier,
      //         {from: relayWorker, gas, gasPrice}
      //     ),
      //     'Unable to initialize SW',
      //     'SW was deployed and initialized'
      // );
    });

    it('Should faild a deployRequest if Manager is unstaked', async () => {
      await mockRelayHub.stakeForAddress(relayManagerAddr, 1000, {
        value: oneRBTC,
        from: relayOwnerAddr,
      });

      let relayWorkersBefore = await mockRelayHub.workerCount(
        relayManagerAddr
      );

      assert.equal(
        relayWorkersBefore.toNumber(),
        0,
        `Initial workers must be zero but was ${relayWorkersBefore.toNumber()}`
      );

      await mockRelayHub.connect(relayManager).addRelayWorkers([relayWorkerAddr], {
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

      const gasPrice = ethers.BigNumber.from('60000000');
      const txResponse = await mockRelayHub.withdrawStake(relayManagerAddr, {
        from: relayOwnerAddr,
        gasPrice,
      });

      //Getting the gas used in order to calculate the original balance of the account
      const txReceipt = await ethers.provider.getTransactionReceipt(txResponse.hash);
      const rbtcUsed = ethers.BigNumber.from(txReceipt.cumulativeGasUsed).mul(gasPrice);

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

      // const calculatedAddr = await factory.getSmartWalletAddress(
      //   gaslessAccount.address,
      //   "0x000000000000000000000000000000",
      //   relayRequestMisbehavingVerifier.request.index
      // );

      const smartWalletFactory =await ethers.getContractFactory('SmartWallet');
      let calculatedAddr: SmartWallet = await smartWalletFactory.deploy();
      await token.mint('1', calculatedAddr);

//         await assert.isRejected(
//           mockRelayHub.deployCall(
//             relayRequestMisbehavingVerifier,
//             signatureWithMisbehavingVerifier,
//             { from: relayWorker, gas, gasPrice }
//           ),
//           ERR_UNSTAKED,
//           'Deploy was processed successfully'
//         );
    });

    it('Should fail when registering with no workers assigned to the Manager', async () => {
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
          from: relayManagerAddr
        }),
        'no relay workers',
        'Relay Server was successfully registered'
      );
    });
  });
})