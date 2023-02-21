import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import { allowTokens } from '../../tasks/allowTokens';

use(chaiAsPromised);

describe('Allow Tokens Script', function () {
  describe('allowTokens', function () {
    const taskArgs = {
      tokenlist: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };

    const contractAddresses = {
      Penalizer: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      RelayHub: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      SmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      SmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      DeployVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      RelayVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWalletDeployVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWalletRelayVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      VersionRegistry: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      UtilToken: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };

    const chainContractAddresses = {
      'hardhat.33': contractAddresses,
    };

    beforeEach(function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      hre.network.config.chainId = 33;
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should allow a list of tokens', async function () {
      const stubContract = sinon.createStubInstance(Contract);
      stubContract['acceptToken'] = () => undefined;
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
