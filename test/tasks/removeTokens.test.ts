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

const A_TOKEN_ADDRESS = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7';
const B_TOKEN_ADDRESS = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D8';
const A_VERIFIER_ADDRESS = '0x123abc';
const B_VERIFIER_ADDRESS = '0xabc123';

describe('Remove Tokens Script', function () {
  const expectRemoveTokensNotToBeRejected = async (
    taskArgs: AllowedTokensArgs
  ) => {
    const stubContract = sinon.createStubInstance(Contract);
    stubContract['removeToken'] = () => undefined;
    stubContract['getAcceptedTokens'] = () => {
      return [A_TOKEN_ADDRESS, B_TOKEN_ADDRESS];
    };
    sinon.stub(ethers, 'getContractAt').resolves(stubContract);
    await expect(removeTokens(taskArgs, hre)).to.not.be.rejected;
  };

  const expectRemoveTokensToBeRejected = async (
    taskArgs: AllowedTokensArgs
  ) => {
    const stubContract = sinon.createStubInstance(Contract);
    stubContract['removeToken'] = () => {
      throw new Error();
    };
    sinon.stub(ethers, 'getContractAt').resolves(stubContract);
    await expect(removeTokens(taskArgs, hre)).to.be.rejected;
  };

  describe('reading the verifiers from file', function () {
    beforeEach(function () {
      sinon.stub(fs, 'existsSync').returns(true);
      stubReadFileSync();
      hre.network.config.chainId = 33;
    });

    afterEach(function () {
      sinon.restore();
    });

    describe('removeTokens with one token', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: A_TOKEN_ADDRESS,
      };

      it('should remove the token', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });

      it('should throw error and print it if token cannot be removed', async function () {
        await expectRemoveTokensToBeRejected(taskArgs);
      });
    });

    describe('removeTokens with multiple tokens', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: `${A_TOKEN_ADDRESS},${B_TOKEN_ADDRESS}`,
      };

      it('should remove the tokens', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });

      it('should throw error and print it if token cannot be removed', async function () {
        await expectRemoveTokensToBeRejected(taskArgs);
      });
    });
  });

  describe('reading the verifiers from args', function () {
    describe('remoteToken using one token and one verifier', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: A_TOKEN_ADDRESS,
        verifierList: A_VERIFIER_ADDRESS,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });

      it('should throw an error', async function () {
        await expectRemoveTokensToBeRejected(taskArgs);
      });
    });
    describe('remoteToken using one token and multiple verifiers', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: A_TOKEN_ADDRESS,
        verifierList: `${A_VERIFIER_ADDRESS},${B_VERIFIER_ADDRESS}`,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });

      it('should throw an error', async function () {
        await expectRemoveTokensToBeRejected(taskArgs);
      });
    });

    describe('remoteToken using multiple tokens and one verifier', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: `${A_TOKEN_ADDRESS},${B_TOKEN_ADDRESS}`,
        verifierList: A_VERIFIER_ADDRESS,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });

      it('should throw an error', async function () {
        await expectRemoveTokensToBeRejected(taskArgs);
      });
    });

    describe('removeToken using multiple tokens and multiple verifiers', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: `${A_TOKEN_ADDRESS},${B_TOKEN_ADDRESS}`,
        verifierList: `${A_VERIFIER_ADDRESS},${B_VERIFIER_ADDRESS}`,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });

      it('should throw an error', async function () {
        await expectRemoveTokensToBeRejected(taskArgs);
      });
    });
  });
});
