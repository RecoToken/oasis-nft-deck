const { ethers } = require("hardhat");

async function main() {
  await hre.run("compile");

  const DeckNFT = await ethers.getContractFactory("DeckNFT");

  console.log("Deploying DeckNFT...");
  const deckNFT = await DeckNFT.deploy();

  await deckNFT.deployed();
  console.log(`DeckNFT deployed to: ${deckNFT.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });