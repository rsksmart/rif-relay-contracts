import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, Contract } from 'ethers';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import { withdraw } from '../../scripts/withdraw';
import sinon from 'sinon';
import { smock } from '@defi-wonderland/smock'

use(chaiAsPromised);
use(smock.matchers);

describe('Withdraw Script', function () {
  describe('getAllowedTokens', function () {
    beforeEach(function () {
      hre.network.config.chainId = 33;
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should withdraw tokens from collector contract 2', async function () {
      const stubERC20 = sinon.createStubInstance(Contract);
      const stubCollector = sinon.createStubInstance(Contract);

      stubERC20['balanceOf'] = () => BigNumber.from(300000000);

      stubCollector['withdraw'] = () => undefined;

      sinon.stub(ethers, 'getContractAt')
        .onFirstCall().resolves(stubERC20)
        .onSecondCall().resolves(stubCollector);

      await expect(
        withdraw(
          {
            collectorAddress: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
            partners: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
            tokenAddress: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
          },
          hre
        )
      ).to.not.be.rejected;
    });
  });
});
