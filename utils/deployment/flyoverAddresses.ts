import { HardhatEthersHelpers } from 'hardhat/types';



export const getFlyoverContractAddresses = async (
  ethers: HardhatEthersHelpers
): Promise<{ pegInContract: string; collateralManagement: string }> => {
  const { chainId } = await ethers.provider.getNetwork();

  const pegInContract =
    process.env['PEGIN_CONTRACT_ADDRESS'] ??
    '';
  const collateralManagement =
    process.env['COLLATERAL_MANAGEMENT_ADDRESS'] ??
    '';

  if (!pegInContract || !collateralManagement) {
    throw new Error(
      `Flyover deployment requires PEGIN_CONTRACT_ADDRESS and COLLATERAL_MANAGEMENT_ADDRESS for chainId ${chainId}`
    );
  }

  return { pegInContract, collateralManagement };
};
