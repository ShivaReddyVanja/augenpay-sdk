import { Keypair, Connection } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Load keypair from file (Solana CLI format)
 */
export function loadKeypairFromFile(filepath: string): Keypair {
  const resolvedPath = filepath.startsWith("~")
    ? path.join(process.env.HOME || "", filepath.slice(1))
    : filepath;

  const secretKeyString = fs.readFileSync(resolvedPath, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Generate a new random keypair
 */
export function generateKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Save keypair to file
 */
export function saveKeypairToFile(keypair: Keypair, filepath: string): void {
  const secretKey = Array.from(keypair.secretKey);
  fs.writeFileSync(filepath, JSON.stringify(secretKey));
}

/**
 * Request airdrop (devnet/localnet only)
 */
export async function requestAirdrop(
  connection: Connection,
  publicKey: any,
  lamports: number = 2_000_000_000
): Promise<string> {
  console.log(`\n🪂 Requesting airdrop of ${lamports / 1e9} SOL...`);
  
  try {
    const signature = await connection.requestAirdrop(publicKey, lamports);
    await connection.confirmTransaction(signature);
    console.log(`✅ Airdrop successful: ${signature.slice(0, 16)}...`);
    return signature;
  } catch (error: any) {
    console.error(`❌ Airdrop failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get SOL balance
 */
export async function getBalance(
  connection: Connection,
  publicKey: any
): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / 1e9; // Convert lamports to SOL
}

/**
 * Load or create keypair
 */
export function loadOrCreateKeypair(filepath: string): Keypair {
  if (fs.existsSync(filepath)) {
    console.log(`📂 Loading keypair from ${filepath}`);
    return loadKeypairFromFile(filepath);
  } else {
    console.log(`🔑 Generating new keypair at ${filepath}`);
    const keypair = generateKeypair();
    saveKeypairToFile(keypair, filepath);
    return keypair;
  }
}

/**
 * Get default Solana CLI keypair
 */
export function getDefaultKeypair(): Keypair {
  const defaultPath = path.join(
    process.env.HOME || "",
    ".config/solana/id.json"
  );
  return loadKeypairFromFile(defaultPath);
}

