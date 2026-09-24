import {
  BigNumber,
  BigNumberish,
  Signature,
  Wallet,
  constants,
  utils,
} from 'ethers';

export const HTLC_NATIVE_ABI = [
  'function redeem(bytes32 preimage, uint256 amount, address sender, uint256 timelock)',
  'function redeemBySig(bytes32 preimage, uint256 amount, address sender, uint256 timelock, address destination, address sweepToken, uint256 minAmountOut, bytes32 callsHash, uint8 v, bytes32 r, bytes32 s) returns (address)',
  'function isActive(bytes32 preimageHash, uint256 amount, address token, address sender, address claimAddress, uint256 timelock) view returns (bool)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
];

export const HTLC_NATIVE_COORDINATOR_ABI = [
  'function redeemAndExecute(bytes32 preimage, uint256 amount, address htlcSender, uint256 timelock, (address target, uint256 value, bytes callData)[] calls, address sweepToken, uint256 minAmountOut, address destination, uint8 v, bytes32 r, bytes32 s)',
  'function HTLC_NATIVE() view returns (address)',
];

const htlcInterface = new utils.Interface(HTLC_NATIVE_ABI);
const coordinatorInterface = new utils.Interface(HTLC_NATIVE_COORDINATOR_ABI);

const REDEEM_TYPES = {
  Redeem: [
    { name: 'preimage', type: 'bytes32' },
    { name: 'amount', type: 'uint256' },
    { name: 'sender', type: 'address' },
    { name: 'timelock', type: 'uint256' },
    { name: 'caller', type: 'address' },
    { name: 'destination', type: 'address' },
    { name: 'sweepToken', type: 'address' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'callsHash', type: 'bytes32' },
  ],
};

export type SwapTerms = {
  preimage: string;
  amount: BigNumber;
  sender: string;
  timelock: BigNumber;
};

export type Call = {
  target: string;
  value: BigNumberish;
  callData: string;
};

export type RedeemAuthorization = {
  caller: string;
  destination: string;
  sweepToken: string;
  minAmountOut: BigNumberish;
  callsHash: string;
};

export const createSwapTerms = (
  overrides: Partial<SwapTerms> = {}
): SwapTerms => ({
  preimage: utils.hexlify(utils.randomBytes(32)),
  amount: utils.parseEther('0.5'),
  sender: Wallet.createRandom().address,
  timelock: BigNumber.from(500),
  ...overrides,
});

export const getPreimageHash = (preimage: string) => utils.sha256(preimage);

export const computeCallsHash = (calls: Call[]) =>
  utils.keccak256(
    utils.defaultAbiCoder.encode(
      ['tuple(address target, uint256 value, bytes callData)[]'],
      [calls]
    )
  );

const getDomain = (htlcAddress: string, chainId: number) => ({
  name: 'HTLCNative',
  version: '1',
  chainId,
  verifyingContract: htlcAddress,
});

export const getDomainSeparator = (htlcAddress: string, chainId: number) =>
  utils._TypedDataEncoder.hashDomain(getDomain(htlcAddress, chainId));

export const signRedeem = async (
  signer: Wallet,
  htlcAddress: string,
  chainId: number,
  terms: SwapTerms,
  authorization: RedeemAuthorization
) =>
  utils.splitSignature(
    await signer._signTypedData(getDomain(htlcAddress, chainId), REDEEM_TYPES, {
      ...terms,
      ...authorization,
    })
  );

export const encodeRedeem = ({
  preimage,
  amount,
  sender,
  timelock,
}: SwapTerms) =>
  htlcInterface.encodeFunctionData('redeem', [
    preimage,
    amount,
    sender,
    timelock,
  ]);

export const encodeRedeemBySig = (
  { preimage, amount, sender, timelock }: SwapTerms,
  { destination, sweepToken, minAmountOut, callsHash }: RedeemAuthorization,
  { v, r, s }: Signature
) =>
  htlcInterface.encodeFunctionData('redeemBySig', [
    preimage,
    amount,
    sender,
    timelock,
    destination,
    sweepToken,
    minAmountOut,
    callsHash,
    v,
    r,
    s,
  ]);

export const encodeRedeemAndExecute = (
  { preimage, amount, sender, timelock }: SwapTerms,
  calls: Call[],
  { destination, sweepToken, minAmountOut }: RedeemAuthorization,
  { v, r, s }: Signature
) =>
  coordinatorInterface.encodeFunctionData('redeemAndExecute', [
    preimage,
    amount,
    sender,
    timelock,
    calls,
    sweepToken,
    minAmountOut,
    destination,
    v,
    r,
    s,
  ]);

export const createRedeemAuthorization = (
  overrides: Partial<RedeemAuthorization> = {}
): RedeemAuthorization => ({
  caller: constants.AddressZero,
  destination: constants.AddressZero,
  sweepToken: constants.AddressZero,
  minAmountOut: 0,
  callsHash: computeCallsHash([]),
  ...overrides,
});

export type RedeemMethod = 'redeem' | 'redeemBySig' | 'redeemAndExecute';

export const REDEEM_METHODS: RedeemMethod[] = [
  'redeem',
  'redeemBySig',
  'redeemAndExecute',
];

type RedeemRequestArgs = {
  method: RedeemMethod;
  htlcAddress: string;
  coordinatorAddress: string;
  smartWalletAddress: string;
  chainId: number;
  claimant?: Wallet;
  terms?: SwapTerms;
  calls?: Call[];
  authorization?: Partial<RedeemAuthorization>;
};

export type RedeemRequest = {
  to: string;
  data: string;
  terms: SwapTerms;
  claimAddress: string;
};

/**
 * Build the `to` and `data` of a request that redeems a swap into the smart wallet,
 * along with the claimAddress the swap must have been created with.
 */
export const createRedeemRequest = async ({
  method,
  htlcAddress,
  coordinatorAddress,
  smartWalletAddress,
  chainId,
  claimant = Wallet.createRandom(),
  terms = createSwapTerms(),
  calls = [],
  authorization = {},
}: RedeemRequestArgs): Promise<RedeemRequest> => {
  switch (method) {
    case 'redeem':
      return {
        to: htlcAddress,
        data: encodeRedeem(terms),
        terms,
        claimAddress: smartWalletAddress,
      };
    case 'redeemBySig': {
      const redeemAuthorization = createRedeemAuthorization({
        caller: smartWalletAddress,
        destination: smartWalletAddress,
        ...authorization,
      });
      const signature = await signRedeem(
        claimant,
        htlcAddress,
        chainId,
        terms,
        redeemAuthorization
      );

      return {
        to: htlcAddress,
        data: encodeRedeemBySig(terms, redeemAuthorization, signature),
        terms,
        claimAddress: claimant.address,
      };
    }
    case 'redeemAndExecute': {
      const redeemAuthorization = createRedeemAuthorization({
        caller: coordinatorAddress,
        destination: smartWalletAddress,
        callsHash: computeCallsHash(calls),
        ...authorization,
      });
      const signature = await signRedeem(
        claimant,
        htlcAddress,
        chainId,
        terms,
        redeemAuthorization
      );

      return {
        to: coordinatorAddress,
        data: encodeRedeemAndExecute(
          terms,
          calls,
          redeemAuthorization,
          signature
        ),
        terms,
        claimAddress: claimant.address,
      };
    }
  }
};
