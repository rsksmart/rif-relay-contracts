import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, Contract, Wallet } from 'ethers';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import {
  withdraw,
  WithdrawSharesArg,
  DEFAULT_TX_GAS,
} from '../../tasks/withdraw';
import sinon, { SinonSpy, SinonStubbedInstance } from 'sinon';
import console from 'console';

use(chaiAsPromised);

const PARTNERS_CONFIG = [
  {
    beneficiary: '0x7986b3DF570230288501EEa3D890bd66948C9B79',
  },
  {
    beneficiary: '0x0a3aA774752ec2042c46548456c094A76C7F3a79',
  },
];
const FIRST_TOKEN = Wallet.createRandom().address;
const SECOND_TOKEN = Wallet.createRandom().address;
const ALLOWED_TOKENS = [FIRST_TOKEN, SECOND_TOKEN];
const SPECIFIED_TX_GAS = 150000;

describe('Withdraw Script', function () {
  const mandatoryArgs: WithdrawSharesArg = {
    collectorAddress: '0xc354D97642FAa06781b76Ffb6786f72cd7746C97',
  };

  describe('Function withdraw()', function () {
    let stubbedERC20: SinonStubbedInstance<Contract>;
    let stubbedCollector: SinonStubbedInstance<Contract>;
    let withdrawSpy: SinonSpy;
    let withdrawTokenSpy: SinonSpy;

    beforeEach(function () {
      stubbedERC20 = sinon.createStubInstance(Contract);
      stubbedERC20['balanceOf'] = () => BigNumber.from(300000000);

      stubbedCollector = sinon.createStubInstance(Contract);
      stubbedCollector['withdraw'] = () => undefined;
      stubbedCollector['withdrawToken'] = () => undefined;
      stubbedCollector['getPartners'] = () => PARTNERS_CONFIG;
      stubbedCollector['getTokens'] = () => ALLOWED_TOKENS;

      withdrawSpy = sinon.spy(stubbedCollector, 'withdraw');
      withdrawTokenSpy = sinon.spy(stubbedCollector, 'withdrawToken');

      sinon
        .stub(ethers, 'getContractAt')
        .withArgs('Collector', sinon.match.any)
        .resolves(stubbedCollector)
        .withArgs(sinon.match.any, FIRST_TOKEN)
        .resolves(stubbedERC20)
        .withArgs(sinon.match.any, SECOND_TOKEN)
        .resolves(stubbedERC20);

      console.log = () => undefined;
      console.error = () => undefined;
    });

    afterEach(function () {
      sinon.restore();
    });

    describe('When all tokens should be withdrawn', function () {
      it('Should call withdraw() with the default tx gas', async function () {
        await withdraw(mandatoryArgs, hre);

        expect(withdrawSpy.withArgs({ gasLimit: DEFAULT_TX_GAS }).calledOnce).to
          .be.true;
      });

      it('Should call withdraw() with specified tx gas', async function () {
        await withdraw({ ...mandatoryArgs, gasLimit: SPECIFIED_TX_GAS }, hre);

        expect(withdrawSpy.withArgs({ gasLimit: SPECIFIED_TX_GAS }).calledOnce)
          .to.be.true;
      });

      it('Should throw error if withdrawal fails', async function () {
        const errorMessage = 'Error on withdrawal!';
        stubbedCollector['withdraw'] = () => {
          throw new Error(errorMessage);
        };

        await expect(withdraw(mandatoryArgs, hre)).to.be.rejectedWith(
          errorMessage
        );
      });
    });

    describe('When only a token should be withdrawn', function () {
      it('Should call withdrawToken() with default tx gas', async function () {
        await withdraw({ ...mandatoryArgs, tokenAddress: FIRST_TOKEN }, hre);

        expect(
          withdrawTokenSpy.withArgs(FIRST_TOKEN, { gasLimit: DEFAULT_TX_GAS })
            .calledOnce
        ).to.be.true;
      });

      it('Should call withdrawToken() with specified tx gas', async function () {
        await withdraw(
          {
            ...mandatoryArgs,
            tokenAddress: FIRST_TOKEN,
            gasLimit: SPECIFIED_TX_GAS,
          },
          hre
        );

        expect(
          withdrawTokenSpy.withArgs(FIRST_TOKEN, { gasLimit: SPECIFIED_TX_GAS })
            .calledOnce
        ).to.be.true;
      });

      it('should throw error if withdrawal fails', async function () {
        const errorMessage = 'Error on withdrawal!';
        stubbedCollector['withdrawToken'] = () => {
          throw new Error(errorMessage);
        };

        await expect(
          withdraw({ ...mandatoryArgs, tokenAddress: FIRST_TOKEN }, hre)
        ).to.be.rejectedWith(errorMessage);
      });
    });
  });
});
