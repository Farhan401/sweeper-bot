const { ethers } = require('ethers');
const { getAllTokens } = require('./utils');

class Sweeper {
  constructor(provider, destination) {
    this.provider = provider;
    this.destination = destination;
    this.ERC20_ABI = [
      'function balanceOf(address) view returns(uint256)',
      'function symbol() view returns(string)',
      'function decimals() view returns(uint8)',
      'function transfer(address,uint256)'
    ];
  }

  async sweepWallet(privateKey, walletAddress = null) {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    const address = walletAddress || wallet.address;
    
    console.log(`Sweeping ${address}...`);
    
    // 1. Sweep Native ETH/BNB/MATIC
    const balance = await this.provider.getBalance(address);
    if (balance > 0n) {
      const tx = await wallet.sendTransaction({
        to: this.destination,
        value: balance - 21000n * 20n, // Leave gas
        gasLimit: 21000
      });
      await tx.wait();
      console.log(`ETH swept: ${ethers.formatEther(balance)}`);
    }
    
    // 2. Sweep ERC20 tokens
    const tokens = await getAllTokens(wallet, this.provider);
    const results = [];
    
    for (const token of tokens) {
      try {
        const contract = new ethers.Contract(token.address, this.ERC20_ABI, wallet);
        const tx = await contract.transfer(this.destination, token.balance, {
          gasLimit: 100000
        });
        await tx.wait();
        results.push(`${token.symbol}: ${ethers.formatUnits(token.balance, token.decimals)}`);
      } catch(e) {
        console.error(`Failed to sweep ${token.symbol}:`, e);
      }
    }
    
    return { address, native: ethers.formatEther(balance), tokens: results };
  }
}

module.exports = Sweeper;
