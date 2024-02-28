import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import {
  AllowedTokensArgs,
  allowTokens,
} from '../../../tasks/tokenHandler/allowTokens';
import { stubReadFileSync } from '../utils';

use(chaiAsPromised);

describe('Allow Tokens Script', function () {
  describe('allowTokens', function () {
    const taskArgs: AllowedTokensArgs = {
      tokenList: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };
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

    it('should allow a list of tokens', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['acceptToken'] = () => fakeHash;
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(allowTokens(taskArgs, hre)).to.not.be.rejected;
    });

    it('should throw error and print it if token cannot be allowed', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['acceptToken'] = () => {
        throw new Error();
      };
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(allowTokens(taskArgs, hre)).to.be.rejected;
    });
  });
});
