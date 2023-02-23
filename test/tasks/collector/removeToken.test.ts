import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon, { SinonSpy } from 'sinon';
import {
  RemoveCollectorTokenArgs,
  removeTokenFromCollector,
} from '../../../tasks/collector/removeToken';
import { Collector } from '../../../typechain-types';

use(chaiAsPromised);

describe('Script to remove tokens to collector', function () {
  describe('removeToken', function () {
    const taskArgs: RemoveCollectorTokenArgs = {
      collectorAddress: '0x06c85B7EA1AA2d030E1a747B3d8d15D5845fd714',
      tokenAddress: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      tokenIndex: 0,
    };

    afterEach(function () {
      sinon.restore();
    });

    it('should remove the token if it is among the ones that are managed', async function () {
      const stubContract = {} as Collector;
      stubContract.removeToken = sinon.spy();
      stubContract.getTokens = sinon.mock().returns([taskArgs.tokenAddress]);
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(
        removeTokenFromCollector(taskArgs, hre),
        'removeTokenFromCollector rejected'
      ).not.to.be.rejected;
      expect(
        (stubContract.removeToken as SinonSpy).calledWithExactly(
          taskArgs.tokenAddress,
          taskArgs.tokenIndex
        ),
        'collector.removeToken was not called'
      ).to.be.true;
    });

    it('should fail if the token index is not correct', async function () {
      const stubContract = {} as Collector;
      stubContract.removeToken = sinon.spy();
      stubContract.getTokens = sinon
        .mock()
        .returns(['0x123456', taskArgs.tokenAddress]);
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(
        removeTokenFromCollector(taskArgs, hre),
        'removeTokenFromCollector did not reject'
      ).to.be.rejectedWith("The token index provided isn't correct");
    });

    it('should fail if the token removal throws an error', async function () {
      const stubContract = {} as Collector;
      const expectedError = new Error('Token not managed');
      stubContract.removeToken = sinon.spy(() => {
        throw expectedError;
      });
      stubContract.getTokens = sinon.mock().returns([taskArgs.tokenAddress]);
      sinon.stub(ethers, 'getContractAt').resolves(stubContract);
      await expect(
        removeTokenFromCollector(taskArgs, hre),
        'removeTokenFromCollector did not reject'
      ).to.be.rejectedWith(expectedError);
      expect(
        (stubContract.removeToken as SinonSpy).called,
        'collector.removeToken was not called'
      ).to.be.true;
    });
  });
});
