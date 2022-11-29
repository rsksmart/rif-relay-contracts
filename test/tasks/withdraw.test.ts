import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, Contract } from 'ethers';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import { withdraw } from '../../tasks/withdraw';
import sinon, { SinonSpy, SinonStub, SinonStubbedInstance } from 'sinon';
import * as utils from '../../tasks/utils';
import {
  ChangePartnerSharesArg,
  PartnerConfig,
} from 'tasks/changePartnerShares';
import console from 'console';

use(chaiAsPromised);

describe('Withdraw Script', function () {
  const mandatoryArgs: ChangePartnerSharesArg = {
    collectorAddress: '0xc354D97642FAa06781b76Ffb6786f72cd7746C97',
    partnerConfig: 'path/to/config/file',
  };
  const parsedPartnerConfig: PartnerConfig = {
    partners: [
      {
        beneficiary: '0x7986b3DF570230288501EEa3D890bd66948C9B79',
        share: 50,
      },
      {
        beneficiary: '0x0a3aA774752ec2042c46548456c094A76C7F3a79',
        share: 50,
      },
    ],
    collectorOwner: '0x4E28f372BCe2d0Bf1B129b6A278F582558BF08a7',
    tokenAddress: '0x726ECC75d5D51356AA4d0a5B648790cC345985ED',
  };
  describe('withdraw', function () {
    let stubbedFileParser: SinonStub;
    let stubbedERC20: SinonStubbedInstance<Contract>;
    let stubbedCollector: SinonStubbedInstance<Contract>;
    let withdrawSpy: SinonSpy;

    beforeEach(function () {
      stubbedFileParser = sinon
        .stub(utils, 'parseJsonFile')
        .returns(parsedPartnerConfig);
      stubbedERC20 = sinon.createStubInstance(Contract);
      stubbedERC20['balanceOf'] = () => BigNumber.from(300000000);
      stubbedCollector = sinon.createStubInstance(Contract);
      stubbedCollector['withdraw'] = () => undefined;
      withdrawSpy = sinon.spy(stubbedCollector, 'withdraw');

      console.log = () => undefined;
      console.error = () => undefined;
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should throw an error if no partners are found in config file', async function () {
      stubbedFileParser.returns({
        partners: [],
      });

      await expect(withdraw(mandatoryArgs, hre)).to.be.rejectedWith(
        `invalid partners in ${mandatoryArgs.partnerConfig}`
      );
    });

    it('should throw error if withdrawal fails', async function () {
      const errorMessage = 'Error on withdrawal!';
      stubbedCollector['withdraw'] = () => {
        throw new Error(errorMessage);
      };

      sinon
        .stub(ethers, 'getContractAt')
        .onFirstCall()
        .resolves(stubbedERC20)
        .onSecondCall()
        .resolves(stubbedCollector);

      await expect(withdraw(mandatoryArgs, hre)).to.be.rejectedWith(
        errorMessage
      );
    });

    it('should withdraw tokens from collector contract using default tx gas', async function () {
      sinon
        .stub(ethers, 'getContractAt')
        .onFirstCall()
        .resolves(stubbedERC20)
        .onSecondCall()
        .resolves(stubbedCollector);

      await withdraw(mandatoryArgs, hre);
      expect(withdrawSpy.withArgs({ gasLimit: 200000 }).calledOnce).to.be.true;
    });

    it('should withdraw tokens from collector contract using specified tx gas', async function () {
      sinon
        .stub(ethers, 'getContractAt')
        .onFirstCall()
        .resolves(stubbedERC20)
        .onSecondCall()
        .resolves(stubbedCollector);

      const gasLimit = 200001;

      const argsWithGasLimit = {
        ...mandatoryArgs,
        gasLimit,
      };

      await withdraw(argsWithGasLimit, hre);
      expect(withdrawSpy.withArgs({ gasLimit }).calledOnce).to.be.true;
    });
  });
});
