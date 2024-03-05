# LayerZero Bridge Native token

## Prepare

1. Install dependencies by running `npm install`
2. Create a `.env` file in the root directory in reference to `.env.example` file
3. Run `npx hardhat compile` to compile the contracts

## Bridge Astar token (ASTR)

To send 1ASTR from `astar`(`astar L1 mainnet`) to `zk-astar`(`Astar zkEVM`), run the following command (Note that the `--quantity` flag is in wei):

`npx hardhat bridge --quantity 1000000000000000000 --target-network zk-astar --network astar`

To send  1ASTR from `zk-astar`(`Astar zkEVM`) to `astar`(`astar L1 mainnet`), run the following command (Note that the `--quantity` flag is in wei):

`npx hardhat bridge --quantity 1000000000000000000 --target-network astar --network zk-astar`