#!/usr/bin/env ts-node

/**
 * Generate fixed keypairs for testing
 * Run this once to create test wallets
 */

import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const KEYPAIRS_DIR = path.join(__dirname, "../.keypairs");

// Ensure directory exists
if (!fs.existsSync(KEYPAIRS_DIR)) {
  fs.mkdirSync(KEYPAIRS_DIR, { recursive: true });
}

// Generate keypairs
const user = Keypair.generate();
const agent = Keypair.generate();
const merchant = Keypair.generate();

// Save keypairs
fs.writeFileSync(
  path.join(KEYPAIRS_DIR, "user.json"),
  JSON.stringify(Array.from(user.secretKey))
);

fs.writeFileSync(
  path.join(KEYPAIRS_DIR, "agent.json"),
  JSON.stringify(Array.from(agent.secretKey))
);

fs.writeFileSync(
  path.join(KEYPAIRS_DIR, "merchant.json"),
  JSON.stringify(Array.from(merchant.secretKey))
);

console.log("🔑 Generated test keypairs!");
console.log("=".repeat(80));
console.log("\n📁 Keypairs saved to: .keypairs/");
console.log("\n👥 Wallet Addresses:");
console.log(`   User:     ${user.publicKey.toBase58()}`);
console.log(`   Agent:    ${agent.publicKey.toBase58()}`);
console.log(`   Merchant: ${merchant.publicKey.toBase58()}`);

console.log("\n💰 Fund these wallets with devnet SOL:");
console.log("=".repeat(80));
console.log("\nOption 1: Web Faucet (Recommended)");
console.log("   Visit: https://faucet.solana.com");
console.log(`   User:     https://faucet.solana.com/?address=${user.publicKey.toBase58()}`);
console.log(`   Agent:    https://faucet.solana.com/?address=${agent.publicKey.toBase58()}`);
console.log(`   Merchant: https://faucet.solana.com/?address=${merchant.publicKey.toBase58()}`);

console.log("\nOption 2: CLI (if not rate-limited)");
console.log(`   solana airdrop 2 ${user.publicKey.toBase58()} --url devnet`);
console.log(`   solana airdrop 2 ${agent.publicKey.toBase58()} --url devnet`);
console.log(`   solana airdrop 1 ${merchant.publicKey.toBase58()} --url devnet`);

console.log("\n✅ After funding, run: yarn sandbox");
console.log("=".repeat(80));

