import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import {
  AllowedContractsArgs,
  allowContracts,
} from '../../../tasks/destinationContractHandler/allowContracts';
import { stubReadFileSync } from '../utils';

use(chaiAsPromised);

describe('Allow Contracts Script', function () {
  describe('allowContracts', function () {
    const taskArgs: AllowedContractsArgs = {
      contractList: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };

    beforeEach(function () {
      sinon.stub(fs, 'existsSync').returns(true);
      stubReadFileSync();
      hre.network.config.chainId = 33;
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should allow a list of contracts', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['acceptContract'] = () => undefined;
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(allowContracts(taskArgs, hre)).to.not.be.rejected;
    });

    it('should throw error and print it if contract cannot be allowed', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['acceptContract'] = () => {
        throw new Error();
      };
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(allowContracts(taskArgs, hre)).to.be.rejected;
    });
  });
});
