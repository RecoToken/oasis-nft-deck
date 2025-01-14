require("@nomiclabs/hardhat-ethers");
require("@oasisprotocol/sapphire-hardhat");
require("dotenv").config();

module.exports = {
  solidity: "0.8.19",
  networks: {
    sapphireTestnet: {
      url: "https://testnet.sapphire.oasis.io",
      chainId: 23295,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};