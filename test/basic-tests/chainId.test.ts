const networks = require('../../truffle');
contract('Basic tests for configurations', () => {
    describe('Tests on BlockChain', () => {
        it('Should verify /"regtest/" ChainId', async () => {
            assert.equal(
                await web3.eth.getChainId(),
                networks.networks.regtest.network_id
            );
        });
    });
});
