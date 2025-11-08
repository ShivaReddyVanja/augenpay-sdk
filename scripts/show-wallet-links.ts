#!/usr/bin/env ts-node

/**
 * Show wallet addresses and funding links
 */

import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const KEYPAIRS_DIR = path.join(__dirname, "../.keypairs");

function loadKeypair(filename: string): Keypair {
  const keypairPath = path.join(KEYPAIRS_DIR, filename);
  const secretKeyString = fs.readFileSync(keypairPath, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

console.log("\n🔑 AugenPay Test Wallets");
console.log("=".repeat(80));

const user = loadKeypair("user.json");
const agent = loadKeypair("agent.json");
const merchant = loadKeypair("merchant.json");

console.log("\n👤 User Wallet:");
console.log(`   Address: ${user.publicKey.toBase58()}`);
console.log(`   Fund: https://faucet.solana.com/?address=${user.publicKey.toBase58()}`);

console.log("\n🤖 Agent Wallet:");
console.log(`   Address: ${agent.publicKey.toBase58()}`);
console.log(`   Fund: https://faucet.solana.com/?address=${agent.publicKey.toBase58()}`);

console.log("\n🏪 Merchant Wallet:");
console.log(`   Address: ${merchant.publicKey.toBase58()}`);
console.log(`   Fund: https://faucet.solana.com/?address=${merchant.publicKey.toBase58()}`);

console.log("\n" + "=".repeat(80));
console.log("💡 Tip: Click the links above or copy addresses to faucet.solana.com");
console.log("✅ Request 2 SOL for each wallet");
console.log("🚀 After funding, run: yarn sandbox");
console.log("=".repeat(80) + "\n");

