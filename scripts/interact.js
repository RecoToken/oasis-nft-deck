require("dotenv").config();
const { ethers } = require("ethers");
const axios = require('axios');
const sapphire = require('@oasisprotocol/sapphire-paratime');
const { AEAD } = require("@oasisprotocol/deoxysii");

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
    console.log(`\nMetadata fetched from IPFS: ${JSON.stringify(response.data)}\n`);

    return response.data;
  } catch (error) {
    console.error("Error fetching metadata:", error.message);
  }
}

function hexToUint8Array(hexString) {
  const cleanedHexString = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  const uint8Array = new Uint8Array(
    cleanedHexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  );

  return uint8Array;
}

function cleanDecodedURI(decryptedString) {
  const filteredArray = decryptedString.filter(byte => byte !== 0);
  const decodedBaseMetadataURI = new TextDecoder().decode(new Uint8Array(filteredArray));
  return decodedBaseMetadataURI.trim().slice(1);
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

  // // 3. Get metadata URI
  // console.log("\n================Fetching metadata URI...================");
  // console.log(`Fetching metadata URI for deck ID ${baseDeckId}...`);
  // const metadata = await deckNFT.getMetadataURI(baseDeckId);
  // console.log(`Metadata URI for deck ${baseDeckId}:`, metadata);

  // console.log(`\nFetching metadata URI for cloned deck ID ${clonedDeckId}...`);
  // const metadataCloned = await deckNFT.getMetadataURI(clonedDeckId);
  // console.log(`Metadata URI for cloned deck ${clonedDeckId}:`, metadataCloned);


  // 3. Update base metadata URI
  try {
    console.log(`\n================Updating metadata URI for deck ID ${clonedDeckId}...================`);
    const updateTx = await deckNFT.updateBaseMetadata(key ,clonedDeckId, NEW_METADATA_URI);
    const updateReceipt = await updateTx.wait();
    console.log("Transaction confirmed:", updateReceipt.transactionHash);

    const updateEvent = updateReceipt.logs
      .map((log) => deckNFT.interface.parseLog(log))
      .find((e) => e.name === "BaseMetadataUpdated");
    console.log(`Updated Metadata URI => Deck ID:${updateEvent.args.playerDeckId} Encrypted URI:${updateEvent.args.encryptedMetadataURI}`);
  } catch (error) {
    console.error("Error nUpdating metadata deck:", error);
  }

  // 4. Get deck data with decrypted metadata
  try {
    console.log("\n================Fetching deck data ...================");
    const deckData = await deckNFT.getDeckData(clonedDeckId);

    const playerAddress = deckData[0];
    baseDeckId = deckData[1];
    clonedDeckId = deckData[2];
    nonce = deckData[3];
    const encryptedMetadataURI = deckData[4];
    const encryptedClonedMetadataURI = deckData[5];

    console.log(`Player Address: ${playerAddress}\n`);
    console.log(`Base Deck ID: ${baseDeckId.toString()}\n`);
    console.log(`Cloned Deck ID: ${clonedDeckId.toString()}\n`);
    console.log(`Nonce: ${ethers.utils.hexlify(nonce)}\n`);
    console.log(`Decrypted Base Metadata URI: ${encryptedMetadataURI}\n`);
    console.log(`Decrypted Cloned Metadata URI: ${encryptedClonedMetadataURI}`);
    console.log("================End of fetching deck data...================\n");


    // DECRYPTION ON SERVER SIDE USING DEOXYSII
    console.log("================Start of decryption...================");
    const aead = new AEAD(key);
    const nonceString = ethers.utils.hexlify(nonce);
    const nonceArray = hexToUint8Array(nonceString).subarray(0, 15);
    const associatedDataArray = new Uint8Array();

    const encryptedBaseMetadataArray = hexToUint8Array(encryptedMetadataURI);
    const decryptedBaseMetadataURI = aead.decrypt(nonceArray, encryptedBaseMetadataArray, associatedDataArray);
    const cleanedStringBase = cleanDecodedURI(decryptedBaseMetadataURI);
    console.log('cleanedStringBase:', cleanedStringBase);
    await getMetadataFromIPFS(cleanedStringBase);

    const encryptedClonedMetadataArray = hexToUint8Array(encryptedClonedMetadataURI);
    const decryptedClonedMetadataURI = aead.decrypt(nonceArray, encryptedClonedMetadataArray, associatedDataArray);
    const cleanedStringCloned = cleanDecodedURI(decryptedClonedMetadataURI);
    console.log('cleanedStringCloned:', cleanedStringCloned);
    await getMetadataFromIPFS(cleanedStringCloned);
    console.log("================End of decryption...================\n");

  } catch (error) {
    console.error("Error fetching deck data:", error);
  }
}

main().catch((error) => {
  console.error("Error:", error);
});