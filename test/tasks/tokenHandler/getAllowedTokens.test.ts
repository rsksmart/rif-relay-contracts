import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import { getAllowedTokens } from '../../../tasks/tokenHandler/getAllowedTokens';
import { stubReadFileSync } from '../utils';

use(chaiAsPromised);

describe('Get Allowed Tokens Script', function () {
  describe('getAllowedTokens', function () {
    beforeEach(function () {
      sinon.stub(fs, 'existsSync').returns(true);
      stubReadFileSync();
      hre.network.config.chainId = 33;
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should get several lists of allowed tokens successfully', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['getAcceptedTokens'] = () => undefined;
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(getAllowedTokens({}, hre)).to.not.be.rejected;
    });

    it('should throw error and print it if error while getting allowed tokens', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['acceptToken'] = () => {
        throw new Error();
      };
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(getAllowedTokens({}, hre)).to.be.rejected;
    });
  });
});
