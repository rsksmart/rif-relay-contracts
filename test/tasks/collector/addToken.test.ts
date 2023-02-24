import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  AddCollectorTokenArgs,
  addTokenToCollector,
} from '../../../tasks/collector/addToken';
import { Collector } from '../../../typechain-types';

use(sinonChai);
use(chaiAsPromised);

describe('Script to add tokens to collector', function () {
  describe('addToken', function () {
    const taskArgs: AddCollectorTokenArgs = {
      collectorAddress: '0x06c85B7EA1AA2d030E1a747B3d8d15D5845fd714',
      tokenAddress: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };

    afterEach(function () {
      sinon.restore();
    });

    it('should add a token when no tokens are managed', async function () {
      const addToken = sinon.spy();
      const fakeCollector = {
        addToken,
      } as unknown as Collector;
      sinon.stub(ethers, 'getContractAt').resolves(fakeCollector);
      await expect(
        addTokenToCollector(taskArgs, hre),
        'addTokenToCollector rejected'
      ).not.to.be.rejected;
      expect(addToken).to.have.been.called;
    });

    it('should fail if the token is already managed', async function () {
      const expectedError = new Error('Token already managed');
      const addToken = sinon.spy(() => {
        throw expectedError;
      });
      const fakeCollector = {
        addToken,
      } as unknown as Collector;
      sinon.stub(ethers, 'getContractAt').resolves(fakeCollector);
      await expect(
        addTokenToCollector(taskArgs, hre),
        'addTokenToCollector did not reject'
      ).to.be.rejectedWith(expectedError);
      expect(addToken).to.have.been.called;
    });
  });
});
