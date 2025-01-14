// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";

contract DeckNFT is ERC721URIStorage, Ownable {
    uint256 private _currentTokenId;
    mapping(uint256 => uint256) public linkedDecks;

    event BaseDeckMinted(
        uint256 indexed baseDeckId,
        address indexed owner,
        string metadataURI
    );
    event DeckCloned(
        uint256 indexed baseDeckId,
        uint256 indexed cloneDeckId,
        address indexed player
    );
    event BaseMetadataUpdated(
        uint256 indexed baseDeckId,
        string newMetadataURI
    );

    constructor() ERC721("DeckNFT", "DCK") {}

    /**
     * @dev Mint Base Deck (NFT A) - only for backend (owner).
     * @param backendWallet Address to receive the base deck.
     * @param metadataURI IPFS URI for the base deck metadata.
     */
    function mintBaseDeck(
        address backendWallet,
        string memory metadataURI
    ) external onlyOwner {
        _currentTokenId++;
        uint256 newDeckId = _currentTokenId;

        _mint(backendWallet, newDeckId);
        _setTokenURI(newDeckId, metadataURI);

        emit BaseDeckMinted(newDeckId, backendWallet, metadataURI);
    }

    /**
     * @dev Clone Deck (NFT B) and transfer to player.
     * @param player Address of the player to receive the cloned deck.
     * @param baseDeckId ID of the base deck to clone.
     * @param metadataURI IPFS URI for the cloned deck metadata.
     */
    function cloneDeck(
        address player,
        uint256 baseDeckId,
        string memory metadataURI
    ) external onlyOwner {
        require(_exists(baseDeckId), "Base deck does not exist");

        _currentTokenId++;
        uint256 cloneDeckId = _currentTokenId;

        _mint(player, cloneDeckId);
        _setTokenURI(cloneDeckId, metadataURI);

        linkedDecks[cloneDeckId] = baseDeckId;

        emit DeckCloned(baseDeckId, cloneDeckId, player);
    }

    /**
     * @dev Update metadata for Base Deck (NFT A).
     * @param baseDeckId ID of the base deck.
     * @param newMetadataURI New IPFS URI for the base deck metadata.
     */
    function updateBaseMetadata(
        uint256 baseDeckId,
        string memory newMetadataURI
    ) external onlyOwner {
        require(_exists(baseDeckId), "Base deck does not exist");
        require(linkedDecks[baseDeckId] == 0, "This is a cloned deck, not a base deck");
        
        _setTokenURI(baseDeckId, newMetadataURI);

        emit BaseMetadataUpdated(baseDeckId, newMetadataURI);
    }

    /**
     * @dev Get Metadata URI for a given deck ID (either base or linked deck).
     * @param deckId ID of the deck.
     * @return Metadata URI of the deck.
     */
    function getMetadataURI(
        uint256 deckId
    ) external view onlyOwner returns (string memory) {
        if (linkedDecks[deckId] != 0) {
            uint256 baseDeckId = linkedDecks[deckId];
            return tokenURI(baseDeckId);
        }
        return tokenURI(deckId);
    }
}
