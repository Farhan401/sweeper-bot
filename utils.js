const CryptoJS = require('crypto-js');
const bip39 = require('bip39');
const { ethers } = require('ethers');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

function decrypt(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

async function getAllTokens(wallet, provider, chainId) {
  const ERC20_ABI = ['function balanceOf(address) view returns(uint256)', 'function symbol() view returns(string)', 'function decimals() view returns(uint8)', 'function totalSupply() view returns(uint256)', 'function transfer(address,uint256)'];
  const tokenList = []; // Common tokens list
  
  // Auto-detect tokens (simplified - use DeBank API in production)
  const code = await provider.getCode(wallet.address);
  if (code === '0x') return [];
  
  // For demo: check USDT, USDC, WETH
  const commonTokens = [
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0xA0b86a33E6441d1A83c7D2136f8A8C8C6A0b5c5f', // USDC
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'  // WETH
  ];
  
  for (const tokenAddr of commonTokens) {
    try {
      const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(wallet.address);
      if (balance > 0n) {
        const symbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        tokenList.push({ address: tokenAddr, balance, symbol, decimals });
      }
    } catch(e) {}
  }
  
  return tokenList;
}

module.exports = { encrypt, decrypt, getAllTokens };
