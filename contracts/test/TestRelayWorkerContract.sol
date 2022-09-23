// SPDX-License-Identifier:MIT
/* solhint-disable avoid-tx-origin */
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IRelayHub.sol";

contract TestRelayWorkerContract {

    function relayCall(
        IRelayHub hub,
        EnvelopingTypes.RelayRequest memory relayRequest,
        address feesReceiver,
        bytes memory signature)
    public
    {
        hub.relayCall(relayRequest, feesReceiver, signature);
    }

    function deployCall(
        IRelayHub hub,
        EnvelopingTypes.DeployRequest memory deployRequest,
        address feesReceiver,
        bytes memory signature)
    public
    {
        hub.deployCall(deployRequest, feesReceiver, signature);
    }
}
