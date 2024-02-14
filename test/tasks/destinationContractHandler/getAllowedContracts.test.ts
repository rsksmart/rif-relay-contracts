import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import { getAllowedContracts } from '../../../tasks/destinationContractHandler/getAllowedContracts';
import { stubReadFileSync } from '../utils';

use(chaiAsPromised);

describe('Get Allowed Contracts Script', function () {
  describe('getAllowedContracts', function () {
    const fakeHash =
      '0xb444a8a7b80f6811f253a995df6e8ef094347ee27e9eeb726a735a931dc660ff';

    beforeEach(function () {
      sinon.stub(fs, 'existsSync').returns(true);
      stubReadFileSync();
      hre.network.config.chainId = 33;
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should get several lists of allowed contracts successfully', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['getAcceptedContracts'] = () => fakeHash;
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(getAllowedContracts({}, hre)).to.not.be.rejected;
    });

    it('should throw error and print it if error while getting allowed contracts', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['acceptContract'] = () => {
        throw new Error();
      };
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(getAllowedContracts({}, hre)).to.be.rejected;
    });
  });
});
