import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import * as utils from '../../scripts/utils';
import { changePartnerShares, ChangePartnerSharesArg, PartnerConfig } from '../../scripts/changePartnerShares';
import sinon from 'sinon';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import Sinon from 'sinon';

use(chaiAsPromised);


describe('Change Partner Shares Script', function () {
  const mandatoryArgs: ChangePartnerSharesArg = { collectorAddress: '0xabc123', partnerConfig: 'path/to/config/file' };
  const allArgs: ChangePartnerSharesArg = { ...mandatoryArgs, gasLimit: 20000 };

  const parsedPartnerConfig: PartnerConfig = {
    partners: [
      {
        beneficiary: '0x123abc',
        share: 50
      },
      {
        beneficiary: '0x456def',
        share: 50
      }
    ]
  };

  describe('changePartnerShares', function () {

    afterEach(function () {
      sinon.restore();
    });

    it("should throw an error if the file specified with 'partnerConfig' doesn't exist", async function () {
      sinon.stub(fs, 'existsSync').returns(false);
      await expect(
        changePartnerShares(
          mandatoryArgs,
          hre
        )
      ).to.be.rejectedWith(`The file ${mandatoryArgs.partnerConfig} doesn't exist`);
    });

    describe('', function () {
      let stubContract: Sinon.SinonStubbedInstance<Contract>;

      beforeEach(function() {
        sinon.stub(utils, 'parseJsonFile').returns(parsedPartnerConfig);
        stubContract = sinon.createStubInstance(Contract);
        stubContract.updateShares = sinon.spy(() => ({} as TransactionResponse));
        sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      })

      it("should successfully call the 'updateShares' method with the partners and the default gas limit", async function () {
        await expect(changePartnerShares(mandatoryArgs, hre)).not.to.be.rejected;
        expect(
          stubContract.updateShares.calledWithExactly(parsedPartnerConfig.partners, {gasLimit: 150000})
        ).to.be.true;
      });

      it("should successfully call the 'updateShares' method with the partners and the gas limit", async function () {
        await expect(changePartnerShares(allArgs, hre)).not.to.be.rejected;
        expect(
          stubContract.updateShares.calledWithExactly(parsedPartnerConfig.partners, {gasLimit: allArgs.gasLimit})
        ).to.be.true;
      });
    })

    it("should raise an error if the transaction is reverted", async function () {
      sinon.stub(utils, 'parseJsonFile').returns(parsedPartnerConfig);
      const stubContract = sinon.createStubInstance(Contract);
      const errorMsg = 'Transaction reverted for some reason';
      stubContract.updateShares = () => {
        throw new Error(errorMsg);
      };
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(changePartnerShares(mandatoryArgs, hre)).to.be.rejectedWith(errorMsg);
    });
  });
});

