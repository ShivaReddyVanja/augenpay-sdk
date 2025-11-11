#!/usr/bin/env ts-node

/**
 * Generate fixed keypairs for testing
 * Run this once to create test wallets
 */

import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const KEYPAIRS_DIR = path.join(__dirname, "../.keypairs");
const FAUCET_URL = "https://faucet.augenpay.com";

interface FaucetResponse {
  success: boolean;
  signature?: string;
  amount?: string;
  recipient?: string;
  explorerUrl?: string;
  error?: string;
  retryAfter?: number;
}

// Ensure directory exists
if (!fs.existsSync(KEYPAIRS_DIR)) {
  fs.mkdirSync(KEYPAIRS_DIR, { recursive: true });
}

// Check if keypairs already exist
const userKeypairPath = path.join(KEYPAIRS_DIR, "user.json");
const agentKeypairPath = path.join(KEYPAIRS_DIR, "agent.json");
const merchantKeypairPath = path.join(KEYPAIRS_DIR, "merchant.json");

const keypairsExist =
  fs.existsSync(userKeypairPath) &&
  fs.existsSync(agentKeypairPath) &&
  fs.existsSync(merchantKeypairPath);

let user: Keypair;
let agent: Keypair;
let merchant: Keypair;

if (keypairsExist) {
  // Load existing keypairs
  console.log("🔑 Loading existing keypairs...");
  console.log("=".repeat(80));
  
  const userSecret = JSON.parse(fs.readFileSync(userKeypairPath, "utf-8"));
  const agentSecret = JSON.parse(fs.readFileSync(agentKeypairPath, "utf-8"));
  const merchantSecret = JSON.parse(fs.readFileSync(merchantKeypairPath, "utf-8"));
  
  user = Keypair.fromSecretKey(Uint8Array.from(userSecret));
  agent = Keypair.fromSecretKey(Uint8Array.from(agentSecret));
  merchant = Keypair.fromSecretKey(Uint8Array.from(merchantSecret));
  
  console.log("\n📁 Using existing keypairs from: .keypairs/");
  console.log("\n👥 Wallet Addresses:");
  console.log(`   User:     ${user.publicKey.toBase58()}`);
  console.log(`   Agent:    ${agent.publicKey.toBase58()}`);
  console.log(`   Merchant: ${merchant.publicKey.toBase58()}`);
  console.log("\n💡 To generate new keypairs, delete the .keypairs/ directory first.");
} else {
  // Generate new keypairs
  user = Keypair.generate();
  agent = Keypair.generate();
  merchant = Keypair.generate();

  // Save keypairs
  fs.writeFileSync(
    userKeypairPath,
    JSON.stringify(Array.from(user.secretKey))
  );

  fs.writeFileSync(
    agentKeypairPath,
    JSON.stringify(Array.from(agent.secretKey))
  );

  fs.writeFileSync(
    merchantKeypairPath,
    JSON.stringify(Array.from(merchant.secretKey))
  );

  console.log("🔑 Generated new test keypairs!");
  console.log("=".repeat(80));
  console.log("\n📁 Keypairs saved to: .keypairs/");
  console.log("\n👥 Wallet Addresses:");
  console.log(`   User:     ${user.publicKey.toBase58()}`);
  console.log(`   Agent:    ${agent.publicKey.toBase58()}`);
  console.log(`   Merchant: ${merchant.publicKey.toBase58()}`);
}

// Auto-funding function
async function requestFunding(address: string, walletName: string): Promise<boolean> {
  try {
    const response = await fetch(`${FAUCET_URL}/faucet/${address}`, {
      method: "GET",
    });
    const data = (await response.json()) as FaucetResponse;

    if (data.success) {
      console.log(`   ✅ ${walletName}: Funded ${data.amount} - ${data.explorerUrl}`);
      return true;
    } else {
      if (response.status === 503 && data.error?.includes("empty")) {
        console.log(`   ❌ ${walletName}: Faucet is empty. We made sure enough faucet is available, but someone exploited 😢`);
      } else if (response.status === 429) {
        const retryMsg = data.retryAfter ? ` (retry after ${data.retryAfter}s)` : "";
        console.log(`   ⚠️  ${walletName}: Rate limit exceeded${retryMsg}`);
      } else {
        console.log(`   ❌ ${walletName}: ${data.error || "Failed to fund"}`);
      }
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ${walletName}: Network error - ${error instanceof Error ? error.message : "Unknown error"}`);
    return false;
  }
}

// Auto-fund all wallets
async function autoFundWallets() {
  // Check if fetch is available (Node 18+)
  if (typeof fetch === "undefined") {
    console.log("\n⚠️  Auto-funding requires Node.js 18+ (fetch API not available)");
    console.log("=".repeat(80));
    showManualFundingOptions();
    return;
  }

  console.log("\n💰 Attempting to auto-fund wallets...");
  console.log("=".repeat(80));

  const results = await Promise.all([
    requestFunding(user.publicKey.toBase58(), "User"),
    requestFunding(agent.publicKey.toBase58(), "Agent"),
    requestFunding(merchant.publicKey.toBase58(), "Merchant"),
  ]);

  const allSuccess = results.every((r) => r);
  const anySuccess = results.some((r) => r);

  if (allSuccess) {
    console.log("\n✅ Happy testing, we autofunded wallets for you!");
    console.log("=".repeat(80));
    console.log("\n✅ After funding, run: yarn sandbox");
  } else if (anySuccess) {
    console.log("\n⚠️  Some wallets were funded, but others failed. Please use manual funding for the failed ones.");
    console.log("=".repeat(80));
    showManualFundingOptions();
  } else {
    console.log("\n❌ Auto-funding failed. Please use manual funding options below.");
    console.log("=".repeat(80));
    showManualFundingOptions();
  }
}

function showManualFundingOptions() {
  console.log("\n💰 Manual Funding Options:");
  console.log("=".repeat(80));
  console.log("\nOption 1: Web Faucet (Recommended)");
  console.log("   Visit: https://faucet.solana.com");
  console.log(`   User:     https://faucet.solana.com/?address=${user.publicKey.toBase58()}`);
  console.log(`   Agent:    https://faucet.solana.com/?address=${agent.publicKey.toBase58()}`);
  console.log(`   Merchant: https://faucet.solana.com/?address=${merchant.publicKey.toBase58()}`);

  console.log("\nOption 2: CLI (if not rate-limited)");
  console.log(`   solana airdrop 1 ${user.publicKey.toBase58()} --url devnet`);
  console.log(`   solana airdrop 1 ${agent.publicKey.toBase58()} --url devnet`);
  console.log(`   solana airdrop 1 ${merchant.publicKey.toBase58()} --url devnet`);

  console.log("\n✅ After funding, run: yarn sandbox");
  console.log("=".repeat(80));
}

// Run auto-funding
autoFundWallets().catch((error) => {
  console.error("\n❌ Error during auto-funding:", error);
  showManualFundingOptions();
  process.exit(1);
});

