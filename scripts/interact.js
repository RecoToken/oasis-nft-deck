require("dotenv").config();
const { ethers } = require("ethers");
const axios = require('axios');
const sapphire = require('@oasisprotocol/sapphire-paratime');

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PLAYER_WALLET_ADDRESS = process.env.PLAYER_WALLET_ADDRESS;
const METADATA_URI = process.env.METADATA_URI;
const CLONED_METADATA_URI = process.env.CLONED_METADATA_URI;
const NEW_METADATA_URI = process.env.NEW_METADATA_URI;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const ABI = require("./DeckNFT.json");

async function getMetadataFromIPFS(metadataURI) {
  try {
    const response = await axios.get(metadataURI);
    console.log("\nMetadata JSON:", JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    console.error("Error fetching metadata:", error.message);
  }
}

async function main() {
  // Initialize provider and signer using the Sapphire Paratime wrapper
  const provider = sapphire.wrapEthersProvider(new ethers.providers.JsonRpcProvider(RPC_URL));
  const wallet = sapphire.wrapEthersSigner(new ethers.Wallet(PRIVATE_KEY, provider));
  const deckNFT = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  var baseDeckId = 0;
  var clonedDeckId = 0;
  var nonce = "";

  const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
  const key = ethers.utils.arrayify(keyBuffer);

  // 1. Mint a base deck to owner wallet
  try {
    console.log("================Mint a base deck================");
    console.log("Sending transaction...");

    const mintTx = await deckNFT.mintBaseDeck(key, METADATA_URI);
    const receipt = await mintTx.wait();
    console.log("Transaction confirmed:", receipt.transactionHash);

    const event = receipt.logs
      .map((log) => deckNFT.interface.parseLog(log))
      .find((e) => e.name === "BaseDeckMinted");

    if (event) {
      baseDeckId = event.args[0];
      nonce = event.args[1];
      const encryptedMetadataURI = event.args[2];

      console.log("Base Deck ID:", baseDeckId.toString());
      console.log("Nonce:", nonce);
      console.log("Encrypted Metadata URI:", encryptedMetadataURI);
    } else {
      console.log("BaseDeckMinted event not found in the transaction logs.");
    }
  } catch (error) {
    console.error("Error minting base deck:", error);
  }

  // 2. Clone a deck to player wallet
  try {
    console.log("\n================Cloning deck...================");
    const cloneTx = await deckNFT.cloneDeck(key, nonce, baseDeckId, PLAYER_WALLET_ADDRESS, CLONED_METADATA_URI);
    const cloneReceipt = await cloneTx.wait();
    console.log("Transaction confirmed:", cloneReceipt.transactionHash);

    const cloneEvent = cloneReceipt.logs
      .map((log) => deckNFT.interface.parseLog(log))
      .find((e) => e.name === "DeckCloned");

    if (cloneEvent) {
      const userWalletAddress = cloneEvent.args[0];
      baseDeckId = cloneEvent.args[1];
      clonedDeckId = cloneEvent.args[2];
      nonce = cloneEvent.args[3];
      const encryptedBaseMetadataURI = cloneEvent.args[4];
      const encryptedClonedMetadataURI = cloneEvent.args[5];

      console.log(`User Wallet Address: ${userWalletAddress}`);
      console.log(`Base Deck ID: ${baseDeckId.toString()}`);
      console.log(`Cloned Deck ID: ${clonedDeckId.toString()}`);
      console.log(`Nonce: ${ethers.utils.hexlify(nonce)}`);
      console.log(`Encrypted Base Metadata URI: ${ethers.utils.hexlify(encryptedBaseMetadataURI)}`);
      console.log(`Encrypted Cloned Metadata URI: ${ethers.utils.hexlify(encryptedClonedMetadataURI)}`);
    } else {
      console.log("DeckCloned event not found.");
    }
  } catch (error) {
    console.error("Error minting cloned base deck:", error);
  }

  // 3. Get metadata URI
  console.log("\n================Fetching metadata URI...================");
  console.log(`Fetching metadata URI for deck ID ${baseDeckId}...`);
  const metadata = await deckNFT.getMetadataURI(baseDeckId);
  console.log(`Metadata URI for deck ${baseDeckId}:`, metadata);

  console.log(`\nFetching metadata URI for cloned deck ID ${clonedDeckId}...`);
  const metadataCloned = await deckNFT.getMetadataURI(clonedDeckId);
  console.log(`Metadata URI for cloned deck ${clonedDeckId}:`, metadataCloned);


  // 4. Update base metadata URI
  try {
    console.log(`\n================Updating metadata URI for deck ID ${clonedDeckId}...================`);
    const updateTx = await deckNFT.updateBaseMetadata(key ,clonedDeckId, NEW_METADATA_URI);
    const updateReceipt = await updateTx.wait();
    console.log("Transaction confirmed:", updateReceipt.transactionHash);

    const updateEvent = updateReceipt.logs
      .map((log) => deckNFT.interface.parseLog(log))
      .find((e) => e.name === "BaseMetadataUpdated");
    console.log(`Updated Metadata URI: ${updateEvent.args.playerDeckId} ${updateEvent.args.encryptedMetadataURI}`);
  } catch (error) {
    console.error("Error nUpdating metadata deck:", error);
  }

  // Fetch the updated metadata URI
  const owner = await deckNFT.ownerOf(baseDeckId);
  console.log("\nOwner of baseDeckId:", owner);
  console.log(`Fetching updated metadata URI for deck ID ${baseDeckId}...`);
  const newMetadata = await deckNFT.getMetadataURI(baseDeckId);
  console.log(`Updated Metadata URI for deck ${baseDeckId}:`, newMetadata);

  const ownerCloned = await deckNFT.ownerOf(clonedDeckId);
  console.log("\nOwner of clonedBaseDeckId:", ownerCloned);
  console.log(`Fetching updated metadata URI for cloned deck ID ${clonedDeckId}...`);
  const newMetadataclonedDeck = await deckNFT.getMetadataURI(clonedDeckId);
  console.log(`Updated Metadata URI for cloned deck ${clonedDeckId}:`, newMetadataclonedDeck);

  await getMetadataFromIPFS(newMetadata);

  // 5. Get deck data with decrypted metadata
  try {
    console.log("\n================Fetching deck data with decrypted metadata...================");
    const deckData = await deckNFT.getDeckDataWithDecryptedMetadata(key, clonedDeckId);
    console.log(`deckData: ${deckData}`);

    const playerAddress = deckData[0];
    const baseDeckId = deckData[1];
    clonedDeckId = deckData[2];
    const nonce = deckData[3];
    const decryptedMetadataURI = deckData[4];
    const decryptedClonedMetadataURI = deckData[5];

    console.log(`Player Address: ${playerAddress}`);
    console.log(`Base Deck ID: ${baseDeckId.toString()}`);
    console.log(`Cloned Deck ID: ${clonedDeckId.toString()}`);
    console.log(`Nonce: ${ethers.utils.hexlify(nonce)}`);
    console.log(`Decrypted Base Metadata URI: ${decryptedMetadataURI}`);
    console.log(`Decrypted Cloned Metadata URI: ${decryptedClonedMetadataURI}`);

  } catch (error) {
    console.error("Error fetching deck data:", error);
  }
}

main().catch((error) => {
  console.error("Error:", error);
});