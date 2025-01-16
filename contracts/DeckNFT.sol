// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";

contract DeckNFT is ERC721URIStorage, Ownable {
    uint256 private _currentTokenId;
    mapping(uint256 => uint256) private linkedDecks;

    struct DeckData {
        address playerAddress;
        uint256 baseDeckId;
        uint256 clonedDeckId;
        bytes32 nonce;
        bytes encryptedMetadataURI;
        bytes encryptedClonedMetadataURI;
    }

    mapping(uint256 => DeckData) private deckData;

    event BaseDeckMinted(
        uint256 indexed baseDeckId,
        bytes32 nonce,
        bytes encryptedMetadataURI
    );

    event DeckCloned(
        address indexed playerAddress,
        uint256 indexed baseDeckId,
        uint256 indexed clonedDeckId,
        bytes32 nonce,
        bytes encryptedMetadataURI,
        bytes encryptedClonedMetadataURI
    );

    event BaseMetadataUpdated(
        uint256 indexed playerDeckId,
        bytes encryptedMetadataURI
    );

    constructor() ERC721("DeckNFT", "DCK") {}

    /**
     * @dev Mint Base Deck (NFT A) - only for backend (owner).
     * * @param key Encryption key used to encrypt the metadata.
     * @param metadataURI IPFS URI for the base deck metadata.
     */
    function mintBaseDeck(
        bytes32 key,
        string memory metadataURI
    ) external onlyOwner {
        _currentTokenId++;
        uint256 newDeckId = _currentTokenId;
        address backendWallet = msg.sender;

        _mint(backendWallet, newDeckId);
        _setTokenURI(newDeckId, metadataURI);

        bytes32 nonce = bytes32(Sapphire.randomBytes(32, ""));
        bytes memory additionalData = "";

        bytes memory encryptedMetadataURI = Sapphire.encrypt(
            key,
            nonce,
            abi.encode(metadataURI),
            additionalData
        );

        emit BaseDeckMinted(newDeckId, nonce, encryptedMetadataURI);
    }

    /**
     * @dev Clone Deck (NFT B) and transfer to player.
     * * @param key Encryption key used to encrypt the metadata.
     * @param nonce Nonce used to encrypt the metadata.
     * @param baseDeckId ID of the base deck to clone.
     * @param userWalletAddress Address of the player to receive the cloned deck.
     * @param metadataURI IPFS URI for the cloned deck metadata.
     */
    function cloneDeck(
        bytes32 key,
        bytes32 nonce,
        uint256 baseDeckId,
        address userWalletAddress,
        string memory metadataURI
    ) external onlyOwner {
        require(_exists(baseDeckId), "Base deck does not exist");

        _currentTokenId++;
        uint256 playerDeckId = _currentTokenId;

        _mint(userWalletAddress, playerDeckId);
        _setTokenURI(playerDeckId, metadataURI);

        linkedDecks[playerDeckId] = baseDeckId;

        bytes memory additionalData = "";
        string memory baseMetadataURI = getMetadataURI(baseDeckId);
        bytes memory encryptedBaseMetadataURI = Sapphire.encrypt(
            key,
            nonce,
            abi.encode(baseMetadataURI),
            additionalData
        );

        bytes memory encryptedClonedMetadataURI = Sapphire.encrypt(
            key,
            nonce,
            abi.encode(metadataURI),
            additionalData
        );

        deckData[playerDeckId] = DeckData({
            playerAddress: userWalletAddress,
            baseDeckId: baseDeckId,
            clonedDeckId: playerDeckId,
            nonce: nonce,
            encryptedMetadataURI: encryptedBaseMetadataURI,
            encryptedClonedMetadataURI: encryptedClonedMetadataURI
        });

        emit DeckCloned(
            userWalletAddress,
            baseDeckId,
            playerDeckId,
            nonce,
            encryptedBaseMetadataURI,
            encryptedClonedMetadataURI
        );
    }

    /**
     * @dev Update metadata for Base Deck (NFT A).
     * @param key Encryption key used to encrypt the metadata.
     * @param playerDeckId ID of the player deck.
     * @param newMetadataURI New IPFS URI for the base deck metadata.
     */
    function updateBaseMetadata(
        bytes32 key,
        uint256 playerDeckId,
        string memory newMetadataURI
    ) external onlyOwner {
        bytes32 nonce = deckData[playerDeckId].nonce;
        uint256 baseDeckId = deckData[playerDeckId].baseDeckId;

        _setTokenURI(baseDeckId, newMetadataURI);

        bytes memory additionalData = "";
        bytes memory encryptedMetadataURI = Sapphire.encrypt(
            key,
            nonce,
            abi.encode(newMetadataURI),
            additionalData
        );

        deckData[playerDeckId].encryptedMetadataURI = encryptedMetadataURI;

        emit BaseMetadataUpdated(playerDeckId, encryptedMetadataURI);
    }

    function getDeckDataWithDecryptedMetadata(
        bytes32 key,
        uint256 playerDeckId
    )
        external
        view
        onlyOwner
        returns (
            address playerAddress,
            uint256 baseDeckId,
            uint256 clonedDeckId,
            bytes32 nonce,
            string memory decryptedMetadataURI,
            string memory decryptedClonedMetadataURI
        )
    {
        DeckData storage data = deckData[playerDeckId];

        bytes memory additionalData = "";
        bytes memory decryptedBaseMetadata = Sapphire.decrypt(
            key,
            data.nonce,
            data.encryptedMetadataURI,
            additionalData
        );
        bytes memory decryptedClonedMetadata = Sapphire.decrypt(
            key,
            data.nonce,
            data.encryptedClonedMetadataURI,
            additionalData
        );

        decryptedMetadataURI = string(decryptedBaseMetadata);
        decryptedClonedMetadataURI = string(decryptedClonedMetadata);

        return (
            data.playerAddress,
            data.baseDeckId,
            data.clonedDeckId,
            data.nonce,
            decryptedMetadataURI,
            decryptedClonedMetadataURI
        );
    }

    /**
     * @dev Get Metadata URI for a given deck ID (either base or linked deck).
     * @param deckId ID of the deck.
     * @return Metadata URI of the deck.
     */
    function getMetadataURI(
        uint256 deckId
    ) public view onlyOwner returns (string memory) {
        if (linkedDecks[deckId] != 0) {
            uint256 baseDeckId = linkedDecks[deckId];
            return tokenURI(baseDeckId);
        }
        return tokenURI(deckId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override onlyOwner returns (string memory) {
        require(
            _exists(tokenId),
            "ERC721URIStorage: URI query for nonexistent token"
        );
        return super.tokenURI(tokenId);
    }
}
