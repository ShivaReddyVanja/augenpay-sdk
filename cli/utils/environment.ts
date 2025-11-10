/**
 * Environment setup for CLI
 * Handles Solana connection, wallet loading, and client initialization
 */

import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { AugenPayClient, AUGENPAY_PROGRAM_ID, CLUSTER_ENDPOINTS, DEFAULT_CLUSTER } from "../../index";
import { loadKeypairFromFile, getBalance } from "../../core/wallet";
import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";

const KEYPAIRS_DIR = path.join(process.cwd(), ".keypairs");

export interface LoadedWallets {
  user: Keypair;
  agent: Keypair;
  merchant: Keypair;
}

export interface Environment {
  connection: Connection;
  cluster: keyof typeof CLUSTER_ENDPOINTS;
  programId: PublicKey;
  wallets: LoadedWallets;
  clients: {
    user: AugenPayClient;
    agent: AugenPayClient;
    merchant: AugenPayClient;
  };
}

/**
 * Load all three wallets from .keypairs directory
 */
export function loadWallets(): LoadedWallets {
  const userPath = path.join(KEYPAIRS_DIR, "user.json");
  const agentPath = path.join(KEYPAIRS_DIR, "agent.json");
  const merchantPath = path.join(KEYPAIRS_DIR, "merchant.json");

  if (!fs.existsSync(userPath) || !fs.existsSync(agentPath) || !fs.existsSync(merchantPath)) {
    console.error(chalk.red("❌ Keypairs not found!"));
    console.log(chalk.yellow("💡 Run: yarn generate-keypairs"));
    process.exit(1);
  }

  return {
    user: loadKeypairFromFile(userPath),
    agent: loadKeypairFromFile(agentPath),
    merchant: loadKeypairFromFile(merchantPath),
  };
}

/**
 * Initialize environment with connection and clients
 */
export async function initializeEnvironment(
  cluster: keyof typeof CLUSTER_ENDPOINTS = DEFAULT_CLUSTER
): Promise<Environment> {
  const wallets = loadWallets();
  const connection = new Connection(CLUSTER_ENDPOINTS[cluster], "confirmed");
  const programId = AUGENPAY_PROGRAM_ID;

  // Initialize clients for each role
  const clients = {
    user: new AugenPayClient(wallets.user, cluster, programId),
    agent: new AugenPayClient(wallets.agent, cluster, programId),
    merchant: new AugenPayClient(wallets.merchant, cluster, programId),
  };

  return {
    connection,
    cluster,
    programId,
    wallets,
    clients,
  };
}

/**
 * Display environment summary
 */
export async function displayEnvironmentSummary(env: Environment): Promise<void> {
  console.log(chalk.cyan("\n" + "=".repeat(80)));
  console.log(chalk.bold.cyan("🔗 AugenPay CLI Environment"));
  console.log(chalk.cyan("=".repeat(80)));

  console.log(chalk.gray(`\n🔗 RPC: ${CLUSTER_ENDPOINTS[env.cluster]}`));
  console.log(chalk.gray(`📦 Program ID: ${env.programId.toBase58()}`));

  console.log(chalk.cyan("\n👥 Wallets Loaded:"));
  console.log(chalk.white(`   User:     ${env.wallets.user.publicKey.toBase58()}`));
  console.log(chalk.white(`   Agent:    ${env.wallets.agent.publicKey.toBase58()}`));
  console.log(chalk.white(`   Merchant: ${env.wallets.merchant.publicKey.toBase58()}`));

  // Check balances
  console.log(chalk.cyan("\n💰 Wallet Balances:"));
  const userBalance = await getBalance(env.connection, env.wallets.user.publicKey);
  const agentBalance = await getBalance(env.connection, env.wallets.agent.publicKey);
  const merchantBalance = await getBalance(env.connection, env.wallets.merchant.publicKey);

  const formatBalance = (balance: number) => {
    if (balance < 0.1) {
      return chalk.red(`${balance.toFixed(4)} SOL ⚠️`);
    }
    return chalk.green(`${balance.toFixed(4)} SOL`);
  };

  console.log(chalk.white(`   User:     ${formatBalance(userBalance)}`));
  console.log(chalk.white(`   Agent:    ${formatBalance(agentBalance)}`));
  console.log(chalk.white(`   Merchant: ${formatBalance(merchantBalance)}`));

  // Warn if balances are low
  if (userBalance < 0.1 || agentBalance < 0.1 || merchantBalance < 0.1) {
    console.log(chalk.yellow("\n⚠️  Some wallets have low SOL — consider topping up:"));
    if (userBalance < 0.1) {
      console.log(chalk.yellow(`   🔗 https://faucet.solana.com/?address=${env.wallets.user.publicKey.toBase58()}`));
    }
    if (agentBalance < 0.1) {
      console.log(chalk.yellow(`   🔗 https://faucet.solana.com/?address=${env.wallets.agent.publicKey.toBase58()}`));
    }
    if (merchantBalance < 0.1) {
      console.log(chalk.yellow(`   🔗 https://faucet.solana.com/?address=${env.wallets.merchant.publicKey.toBase58()}`));
    }
  }

  console.log(chalk.cyan("\n" + "=".repeat(80) + "\n"));
}

/**
 * Get explorer link for transaction
 */
export function getExplorerLink(signature: string, cluster: keyof typeof CLUSTER_ENDPOINTS = DEFAULT_CLUSTER): string {
  const clusterParam = cluster === "devnet" ? "?cluster=devnet" : cluster === "mainnet" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
}

/**
 * Format transaction signature with explorer link
 */
export function formatTransaction(signature: string, cluster: keyof typeof CLUSTER_ENDPOINTS = DEFAULT_CLUSTER): string {
  const shortSig = `${signature.slice(0, 16)}...`;
  const link = getExplorerLink(signature, cluster);
  return chalk.green(`✅ TX: ${shortSig}`) + chalk.gray(`\n   🔗 ${link}`);
}

