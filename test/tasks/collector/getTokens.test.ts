import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon, { SinonSpy } from 'sinon';
import {
  getCollectorTokens,
  GetCollectorTokensArgs,
} from '../../../tasks/collector/getTokens';
import { Collector } from '../../../typechain-types';

use(chaiAsPromised);

describe('Script to retrieve the collector tokens', function () {
  describe('getTokens', function () {
    const taskArgs: GetCollectorTokensArgs = {
      collectorAddress: '0x06c85B7EA1AA2d030E1a747B3d8d15D5845fd714',
    };
    const tokens = ['0x123abc', '0xabc123'];
    let consoleLogSpy: SinonSpy;

    beforeEach(function () {
      consoleLogSpy = sinon.spy(console, 'log');
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should get the tokens managed by the collector', async function () {
      const getTokens = sinon.stub().returns(Promise.resolve(tokens));
      const fakeCollector = {
        getTokens,
      } as unknown as Collector;
      sinon.stub(ethers, 'getContractAt').resolves(fakeCollector);
      await expect(
        getCollectorTokens(taskArgs, hre),
        'getCollectorTokens rejected'
      ).not.to.be.rejected;
      expect(getTokens.called, 'Collector.getTokens was not called').to.be.true;
      expect(
        consoleLogSpy.calledWithExactly('Allowed Tokens:', tokens),
        'Console.log was not called with the expected arguments'
      ).to.be.true;
    });

    it('should fail if the getTokens task raises an error', async function () {
      const expectedError = new Error('Token already managed');
      const getTokens = sinon.spy(() => {
        throw expectedError;
      });
      const stubContract = {
        getTokens,
      } as unknown as Collector;
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(
        getCollectorTokens(taskArgs, hre),
        'getCollectorTokens did not reject'
      ).to.be.rejectedWith(expectedError);
      expect(consoleLogSpy.called, 'Console.log was called').to.be.false;
    });
  });
});
