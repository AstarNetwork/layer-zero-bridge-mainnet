import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import dotenv from 'dotenv';
import {ethers} from "ethers";


dotenv.config();
const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    "zk-astar": {
      url: `https://rpc.startale.com/astar-zkevm`,
      chainId: 3776,
      accounts: [process.env.ACCOUNT_PRIVATE_KEY as string],
    },
    "astar": {
      url: "https://evm.astar.network",
      chainId: 592,
      gas: 10000000, // tx gas limit
      accounts: [process.env.ACCOUNT_PRIVATE_KEY as string],
    }
  },
};

export default config;

const ENDPOINT_ID: { [key: string]: number } = {
  "zk-astar": 257,
  "astar": 210
}

task("bridge", "Bridge ASTR")
  .addParam('quantity', ``)
  .addParam('targetNetwork', ``)
  .setAction(async (taskArgs, hre) => {
    let signers = await hre.ethers.getSigners()
    let owner = signers[0]
    let nonce = await hre.ethers.provider.getTransactionCount(owner.address)
    let toAddress = owner.address;
    let qty = BigInt(taskArgs.quantity)

    let localContractInstance;
    if (taskArgs.targetNetwork === "astar") {
        localContractInstance = await hre.ethers.getContractAt("contracts/OFTWithFee.sol:OFTWithFee", "0xdf41220C7e322bFEF933D85D01821ad277f90172", owner)
    }  else if (taskArgs.targetNetwork === "zk-astar") {
        localContractInstance = await hre.ethers.getContractAt("contracts/OFTNativeWithFee.sol:NativeOFTWithFee", "0xdf41220C7e322bFEF933D85D01821ad277f90172", owner)
    }
    else {
        console.log("Invalid targetNetwork")
        return
    }

    // get remote chain id
    const remoteChainId = ENDPOINT_ID[taskArgs.targetNetwork]

    // quote fee with default adapterParams
    let adapterParams = hre.ethers.solidityPacked(["uint16", "uint256"], [1, 100000])

    // convert to address to bytes32
    let toAddressBytes32 = hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [toAddress])

    // quote send function
    let fees = await localContractInstance.estimateSendFee(remoteChainId, toAddressBytes32, qty, false, adapterParams)

    let newFee
    // need to add extra value if sending from astar
    if (hre.network.name === "astar") {
      newFee = fees[0] + qty
    }

    // define min qty to receive on the destination
    let minQty = qty/BigInt(2);

    const tx = await localContractInstance.sendFrom(
        owner.address,                                       // 'from' address to send tokens
        remoteChainId,                                       // remote LayerZero chainId
        toAddressBytes32,                                    // 'to' address to send tokens
        qty,                                                 // amount of tokens to send (in wei)
        minQty,                                              // min amount of tokens to send (in wei)
        {
          refundAddress: owner.address,                    // refund address (if too much message fee is sent, it gets refunded)
          zroPaymentAddress: hre.ethers.ZeroAddress, // address(0x0) if not paying in ZRO (LayerZero Token)
          adapterParams: adapterParams                     // flexible bytes array to indicate messaging adapter services
        },
        { value: hre.network.name === "astar" ? newFee : fees[0], gasLimit: 1000000, nonce: nonce++ }
        )
    
    console.log(`✅ Message Sent [${hre.network.name}] sendTokens() to OFT @ LZ chainId[${remoteChainId}]`)
    console.log(`* check your address [${owner.address}] on the destination chain, in the ERC20 transaction tab !"`)
  });

task("BridgeDOT", "Bridge XC20 DOT")
    .addParam('quantity', ``)
    .addParam('targetNetwork', ``)
    .setAction(async (taskArgs, hre) => {
        let signers = await hre.ethers.getSigners()
        let owner = signers[0]
        let nonce = await hre.ethers.provider.getTransactionCount(owner.address)
        let toAddress = owner.address;
        let qty = BigInt(taskArgs.quantity)

        let oftAddress;
        let localContractInstance;
        if (taskArgs.targetNetwork === "astar") {
            oftAddress = "0x7Cb5d4D178d93D59ea0592abF139459957898a59"
            localContractInstance = await hre.ethers.getContractAt("contracts/OFTWithFee.sol:OFTWithFee", "0x7Cb5d4D178d93D59ea0592abF139459957898a59", owner)
        } else if (taskArgs.targetNetwork === "zk-astar") {
            oftAddress = "0x105C0F4a5Eae3bcb4c9Edbb3FD5f6b60FAcc3b36"
            localContractInstance = await hre.ethers.getContractAt("contracts/ProxyOFTWithFee.sol:ProxyOFTWithFee", "0x105C0F4a5Eae3bcb4c9Edbb3FD5f6b60FAcc3b36", owner)
        }
        else {
            console.log("Invalid targetNetwork")
            return
        }

        // get remote chain id
        const remoteChainId = ENDPOINT_ID[taskArgs.targetNetwork]

        // quote fee with default adapterParams
        let adapterParams = hre.ethers.solidityPacked(["uint16", "uint256"], [1, 225000 + 300000]) // min gas of OFT + gas for call

        // convert to address to bytes32
        let toAddressBytes32 = hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [toAddress])

        // quote send function
        let fees = await localContractInstance.estimateSendFee(remoteChainId, toAddressBytes32, qty, false, adapterParams)

        if (taskArgs.targetNetwork === "zk-astar") {
            let erc20 = await hre.ethers.getContractAt("contracts/OFTWithFee.sol:IERC20", "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF", owner)
            await erc20.approve(oftAddress, qty, { gasLimit: 10000000, nonce: nonce++ })
        }

        const tx = await localContractInstance.sendFrom(
            owner.address,                                       // 'from' address to send tokens
            remoteChainId,                                       // remote LayerZero chainId
            toAddressBytes32,                                    // 'to' address to send tokens
            qty,                                                 // amount of tokens to send (in wei)
            qty,                                              // min amount of tokens to send (in wei)
            {
                refundAddress: owner.address,                    // refund address (if too much message fee is sent, it gets refunded)
                zroPaymentAddress: hre.ethers.ZeroAddress, // address(0x0) if not paying in ZRO (LayerZero Token)
                adapterParams: adapterParams                     // flexible bytes array to indicate messaging adapter services
            },
            { value: fees[0], gasLimit: 10000000, nonce: nonce++ }
        )

        console.log(`✅ Message Sent [${hre.network.name}] sendTokens() to OFT @ LZ chainId[${remoteChainId}] token:[${toAddress}]`)
        console.log(`* check your address [${owner.address}] on the destination chain, in the ERC20 transaction tab !"`)
    });