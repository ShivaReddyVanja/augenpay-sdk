import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { CLUSTER_ENDPOINTS, DEFAULT_CLUSTER, COMMITMENT } from "../config/constants";

/**
 * Create a Solana connection
 */
export function createConnection(
  cluster: keyof typeof CLUSTER_ENDPOINTS = DEFAULT_CLUSTER
): Connection {
  const endpoint = CLUSTER_ENDPOINTS[cluster];
  return new Connection(endpoint, COMMITMENT);
}

/**
 * Create an Anchor provider
 */
export function createProvider(
  connection: Connection,
  wallet: anchor.Wallet
): anchor.AnchorProvider {
  return new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: COMMITMENT }
  );
}

/**
 * Create a wallet from keypair
 */
export function createWallet(keypair: Keypair): anchor.Wallet {
  return new anchor.Wallet(keypair);
}

/**
 * Get or create AugenPay program instance
 */
export async function getProgram(
  provider: anchor.AnchorProvider,
  programId: anchor.web3.PublicKey
): Promise<anchor.Program> {
  // Load IDL from chain
  const idl = await anchor.Program.fetchIdl(programId, provider);
  
  if (!idl) {
    throw new Error("IDL not found for program: " + programId.toBase58());
  }

  return new anchor.Program(idl as anchor.Idl, provider);
}

/**
 * Convenience function to get everything set up
 */
export async function initializeClient(
  wallet: Keypair,
  cluster: keyof typeof CLUSTER_ENDPOINTS = DEFAULT_CLUSTER,
  programId: anchor.web3.PublicKey
) {
  const connection = createConnection(cluster);
  const anchorWallet = createWallet(wallet);
  const provider = createProvider(connection, anchorWallet);
  const program = await getProgram(provider, programId);

  return {
    connection,
    wallet: anchorWallet,
    provider,
    program,
  };
}

