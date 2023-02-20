import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { BaseProvider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  BaseContract,
  BigNumber,
  ContractTransaction,
  ethers,
  PayableOverrides,
  Wallet,
} from 'ethers';
import { ethers as hardhat } from 'hardhat';
import {
  ERC20,
  NativeHolderSmartWallet,
  NativeHolderSmartWallet__factory,
} from '../../typechain-types';
import { PromiseOrValue } from '../../typechain-types/common';
import {
  getLocalEip712Signature,
  TypedRequestData,
} from '../utils/EIP712Utils';
import {
  buildDomainSeparator,
  createRequest,
  getSuffixData,
  HARDHAT_CHAIN_ID,
} from './utils';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const recipientABI = [
  {
    inputs: [
      {
        internalType: 'string',
        name: 'message',
        type: 'string',
      },
    ],
    name: 'emitMessage',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
];
interface TestRecipient extends BaseContract {
  functions: {
    emitMessage(
      message: PromiseOrValue<string>,
      overrides?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;
  };
}

const INITIAL_SW_BALANCE = hardhat.utils.parseEther('5');
const TWO_ETHERS = ethers.utils.parseEther('2');

describe('NativeHolderSmartWallet contract', function () {
  let smartWallet: MockContract<NativeHolderSmartWallet>;
  let provider: BaseProvider;
  let owner: Wallet;
  let fakeToken: FakeContract<ERC20>;
  let fundedAccount: SignerWithAddress;
  let relayHub: SignerWithAddress;
  let worker: SignerWithAddress;
  let privateKey: Buffer;
  let recipientContract: FakeContract<TestRecipient>;
  let encodedFunctionData: string;

  beforeEach(async function () {
    [relayHub, fundedAccount, worker] = (await hardhat.getSigners()) as [
      SignerWithAddress,
      SignerWithAddress,
      SignerWithAddress
    ];

    const mockSmartWalletFactory =
      await smock.mock<NativeHolderSmartWallet__factory>(
        'NativeHolderSmartWallet'
      );

    provider = hardhat.provider;
    owner = hardhat.Wallet.createRandom().connect(provider);

    //Fund the owner
    await fundedAccount.sendTransaction({
      to: owner.address,
      value: hardhat.utils.parseEther('1'),
    });
    smartWallet = await mockSmartWalletFactory.connect(owner).deploy();
    const domainSeparator = buildDomainSeparator(smartWallet.address);
    await smartWallet.setVariable('domainSeparator', domainSeparator);

    fakeToken = await smock.fake('ERC20');
    fakeToken.transfer.returns(true);

    privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');

    recipientContract = await smock.fake<TestRecipient>(recipientABI);
    encodedFunctionData = recipientContract.interface.encodeFunctionData(
      'emitMessage',
      ['hello']
    );

    await fundedAccount.sendTransaction({
      to: smartWallet.address,
      value: INITIAL_SW_BALANCE,
    });
  });

  async function expectBalanceToBeRight(
    execution: () => Promise<void>,
    recipientAddress: string,
    expectedRecipientBalance: BigNumber,
    expectedSwBalance: BigNumber
  ) {
    await execution();

    const recipientBalanceAfterExecution = await provider.getBalance(
      recipientAddress
    );
    const swBalanceAfterExecution = await provider.getBalance(
      smartWallet.address
    );

    expect(expectedRecipientBalance.toString()).to.be.equal(
      recipientBalanceAfterExecution.toString()
    );
    expect(expectedSwBalance.toString()).to.be.equal(
      swBalanceAfterExecution.toString()
    );
  }

  async function expectBalanceAfterSuccessExecution(
    recipientAddress: string,
    value: BigNumber,
    execution: () => Promise<void>
  ) {
    const recipientBalancePriorExecution = await provider.getBalance(
      recipientAddress
    );
    const swBalancePriorExecution = await provider.getBalance(
      smartWallet.address
    );

    const valueBN = BigNumber.from(value);

    const expectedRecipientBalance = BigNumber.from(
      recipientBalancePriorExecution
    ).add(valueBN);
    const expectedSwBalance = BigNumber.from(swBalancePriorExecution).sub(
      valueBN
    );
    await expectBalanceToBeRight(
      execution,
      recipientAddress,
      expectedRecipientBalance,
      expectedSwBalance
    );
  }

  describe('execute', function () {
    type PrepareRequestParams = {
      data: string;
      value?: string;
    };

    function prepareRequest({
      data = '0x',
      value = TWO_ETHERS.toString(),
    }: PrepareRequestParams) {
      const relayRequest = createRequest(
        {
          relayHub: relayHub.address,
          from: owner.address,
          to: recipientContract.address,
          tokenAmount: '10',
          tokenGas: '40000',
          tokenContract: fakeToken.address,
          data,
          value,
        },
        {
          callForwarder: smartWallet.address,
        }
      );

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        smartWallet.address,
        relayRequest
      );
      const signature = getLocalEip712Signature(typedRequestData, privateKey);
      const suffixData = getSuffixData(typedRequestData);

      return {
        relayRequest,
        suffixData,
        signature,
      };
    }

    it('Should transfer native currency without executing transactions', async function () {
      const { relayRequest, suffixData, signature } = prepareRequest({
        data: '0x',
        value: TWO_ETHERS.toString(),
      });

      const execution = async () => {
        await expect(
          smartWallet
            .connect(relayHub)
            .execute(
              suffixData,
              relayRequest.request,
              worker.address,
              signature
            )
        ).not.to.be.rejected;

        expect(fakeToken.transfer, 'Token.transfer() was not called').to.be
          .called;
      };

      await expectBalanceAfterSuccessExecution(
        recipientContract.address,
        TWO_ETHERS,
        execution
      );
    });

    it('Should transfer native currency and execute transaction', async function () {
      const { relayRequest, suffixData, signature } = prepareRequest({
        data: encodedFunctionData,
      });

      const execution = async () => {
        await expect(
          smartWallet
            .connect(relayHub)
            .execute(
              suffixData,
              relayRequest.request,
              worker.address,
              signature
            )
        ).not.to.be.rejected;

        expect(fakeToken.transfer, 'Token.transfer() was not called').to.be
          .called;
        expect(recipientContract.emitMessage, 'Recipient method was not called')
          .to.be.called;
      };

      await expectBalanceAfterSuccessExecution(
        recipientContract.address,
        TWO_ETHERS,
        execution
      );
    });

    it('Should fail if the smart wallet cannot pay native currency', async function () {
      // we try to transfer a value higher than the SW balance
      const valueToTransfer = INITIAL_SW_BALANCE.add(
        ethers.utils.parseEther('1')
      ).toString();
      const { relayRequest, suffixData, signature } = prepareRequest({
        data: encodedFunctionData,
        value: valueToTransfer.toString(),
      });

      const execution = async function () {
        // Use the static call to check the returned values
        const tx = await smartWallet
          .connect(relayHub)
          .callStatic.execute(
            suffixData,
            relayRequest.request,
            worker.address,
            signature
          );
        expect(tx.success, 'Success is true').to.be.false;

        await expect(
          smartWallet
            .connect(relayHub)
            .execute(
              suffixData,
              relayRequest.request,
              worker.address,
              signature
            ),
          'Execute transaction rejected'
        ).not.to.be.rejected;
      };

      const recipientBalancePriorExecution = await provider.getBalance(
        recipientContract.address
      );
      const swBalancePriorExecution = await provider.getBalance(
        smartWallet.address
      );

      await expectBalanceToBeRight(
        execution,
        recipientContract.address,
        recipientBalancePriorExecution,
        swBalancePriorExecution
      );
    });
  });

  describe('Function directExecuteWithValue()', function () {
    it('Should transfer native currency without executing transactions', async function () {
      const execution = async () => {
        await expect(
          smartWallet.directExecuteWithValue(
            recipientContract.address,
            TWO_ETHERS,
            '0x00'
          ),
          'Execution failed'
        ).not.to.be.rejected;
      };
      await expectBalanceAfterSuccessExecution(
        recipientContract.address,
        TWO_ETHERS,
        execution
      );
    });

    it('Should transfer native currency and execute transactions', async function () {
      const value = ethers.utils.parseEther('2');
      const execution = async () => {
        await expect(
          smartWallet.directExecuteWithValue(
            recipientContract.address,
            value,
            encodedFunctionData
          ),
          'Execution failed'
        ).not.to.be.rejected;
      };
      await expectBalanceAfterSuccessExecution(
        recipientContract.address,
        value,
        execution
      );
    });

    it('Should fail if the smart wallet cannot pay native currency', async function () {
      const recipientBalancePriorExecution = await provider.getBalance(
        recipientContract.address
      );
      const swBalancePriorExecution = await provider.getBalance(
        smartWallet.address
      );

      const valueToTransfer = INITIAL_SW_BALANCE.add(
        ethers.utils.parseEther('1')
      );

      const execution = async () => {
        // Use the static call to check the returned values
        const tx = await smartWallet.callStatic.directExecuteWithValue(
          recipientContract.address,
          valueToTransfer,
          encodedFunctionData
        );
        expect(tx.success, 'Success is true').to.be.false;

        await expect(
          smartWallet.directExecuteWithValue(
            recipientContract.address,
            valueToTransfer,
            encodedFunctionData
          ),
          'Execution failed'
        ).not.to.be.rejected;
      };

      await expectBalanceToBeRight(
        execution,
        recipientContract.address,
        recipientBalancePriorExecution,
        swBalancePriorExecution
      );
    });
  });
});
