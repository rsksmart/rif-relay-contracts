import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import { removeTokens } from '../../tasks/removeTokens';
import { stubReadFileSync } from './utils';
import { AllowedTokensArgs } from 'tasks/allowTokens';

use(chaiAsPromised);

describe('Remove Tokens Script', function () {
  describe('removeTokens', function () {
    const taskArgs: AllowedTokensArgs = {
      tokenList: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };

    beforeEach(function () {
      sinon.stub(fs, 'existsSync').returns(true);
      stubReadFileSync();
      hre.network.config.chainId = 33;
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should remove a list of tokens', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['removeToken'] = () => undefined;
      stubContract['getAcceptedTokens'] = () => {
        return [
          '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D8',
          '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
        ];
      };
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(removeTokens(taskArgs, hre)).to.not.be.rejected;
    });

    it('should throw error and print it if token cannot be removed', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['removeToken'] = () => {
        throw new Error();
      };
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(removeTokens(taskArgs, hre)).to.be.rejected;
    });
  });
});
