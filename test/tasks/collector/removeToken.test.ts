import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ManageCollectorTokenArgs } from 'tasks/collector/addToken';
import { removeTokenFromCollector } from '../../../tasks/collector/removeToken';
import { Collector } from '../../../typechain-types';

use(sinonChai);
use(chaiAsPromised);

describe('Script to remove tokens from collector', function () {
  describe('removeToken', function () {
    const taskArgs: ManageCollectorTokenArgs = {
      collectorAddress: '0x06c85B7EA1AA2d030E1a747B3d8d15D5845fd714',
      tokenAddress: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };

    afterEach(function () {
      sinon.restore();
    });

    it('should remove the token if it is among the ones that are managed', async function () {
      const removeToken = sinon.spy();
      const expectedTokenIndex = 0;
      const getTokens = sinon.mock().returns([taskArgs.tokenAddress]);
      const fakeCollector = {
        removeToken,
        getTokens,
      } as unknown as Collector;
      sinon.stub(ethers, 'getContractAt').resolves(fakeCollector);
      await expect(
        removeTokenFromCollector(taskArgs, hre),
        'removeTokenFromCollector rejected'
      ).not.to.be.rejected;
      expect(removeToken).to.have.been.calledWithExactly(
        taskArgs.tokenAddress,
        expectedTokenIndex
      );
    });

    it('should fail if the token cannot be found', async function () {
      const fakeCollector = {
        removeToken: sinon.spy(),
        getTokens: sinon.mock().returns(['0x123456', '0xabc123']),
      } as unknown as Collector;

      sinon.stub(ethers, 'getContractAt').resolves(fakeCollector);
      await expect(
        removeTokenFromCollector(taskArgs, hre),
        'removeTokenFromCollector did not reject'
      ).to.be.rejectedWith(
        `Token with address ${taskArgs.tokenAddress} not found`
      );
    });

    it('should fail if the token removal throws an error', async function () {
      const expectedError = new Error('Token not managed');
      const removeToken = sinon.spy(() => {
        throw expectedError;
      });
      const fakeCollector = {
        removeToken,
      } as unknown as Collector;
      fakeCollector.getTokens = sinon.mock().returns([taskArgs.tokenAddress]);
      sinon.stub(ethers, 'getContractAt').resolves(fakeCollector);
      await expect(
        removeTokenFromCollector(taskArgs, hre),
        'removeTokenFromCollector did not reject'
      ).to.be.rejectedWith(expectedError);
      expect(removeToken).to.have.been.called;
    });
  });
});
