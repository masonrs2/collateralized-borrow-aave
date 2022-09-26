const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWETH")

async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()

    /**
     * abi, address (Lending Pool Provider)
     * Address: https://etherscan.io/address/0xb53c1a33016b2dc2ff3653530bff1848a515c8c5
     *
     * abi:
     * */
    const lendingPool = await getLendingPool(deployer)
    console.log(`LendingPool address: ${lendingPool.address}`)

    // Deposit wETH
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

    // Must approve the transfer before a transfer is able to be made.
    await approveERC20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("Depositing...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Desposited!")

    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)

    const daiPrice = await getDaiPrice()
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())

    console.log(`You are able to borrow ${amountDaiToBorrow} DAI`)

    // BORROW Operations (how much we have in collateral & how much we can borrow)
    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    await borrowDAI(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)

    console.log()
    await getBorrowUserData(lendingPool, deployer)
    await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer)
    console.log()
    await getBorrowUserData(lendingPool, deployer)
}

async function repay(amount, daiAddress, lendingPool, account) {
  await approveERC20(daiAddress, lendingPool.address, amount, account)
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
  await repayTx.wait(1)

  console.log("Repaid Borrowed Amount ")
}

async function borrowDAI(daiAddress, lendingPool, amountDaiToBorrowWei, account) {
    const borrowTx = await lendingPool.borrow(
      daiAddress, 
      amountDaiToBorrowWei, 
      1, 
      0, 
      account)

    await borrowTx.wait(1)

    console.log("Borrow transfer completed! ")
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        "0x773616E4d11A78F511299002da57A0a94577F1f4"
    )

    const daiPrice = (await daiEthPriceFeed.latestRoundData())[1]

    console.log(`Current price of DAI/ETH is: ${daiPrice.toString()}`)
    return daiPrice
}

// Acquring information revolving around a individuls borrowed details
async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)

    console.log(`Total Collateral (ETH): ${totalCollateralETH}`)
    console.log(`Total Debt (ETH): ${totalDebtETH}`)
    console.log(`Available Borrow Funds (ETH): ${availableBorrowsETH}`)

    return { availableBorrowsETH, totalDebtETH }
}

async function approveERC20(ERC20Address, spenderAddress, amount, account) {
    const ERC20Token = await ethers.getContractAt("IERC20", ERC20Address, account)

    const tx = await ERC20Token.approve(spenderAddress, amount)
    await tx.wait(1)

    console.log("Approved transaction!")
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5",
        account
    )

    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)

    return lendingPool
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
