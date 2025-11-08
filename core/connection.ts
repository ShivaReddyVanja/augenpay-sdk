import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { CLUSTER_ENDPOINTS, DEFAULT_CLUSTER, COMMITMENT } from "../config/constants";
import idl from "../augenpay-idl.json";

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
 * Uses local IDL file instead of fetching from chain for better performance and reliability
 */
export function getProgram(
  provider: anchor.AnchorProvider,
  programId: anchor.web3.PublicKey
): anchor.Program {
  // Load IDL from local file (shipped with SDK)
  const idlData = idl as anchor.Idl;
  
  // Verify program ID matches
  if (idlData.address && idlData.address !== programId.toBase58()) {
    console.warn(
      `Warning: Program ID mismatch. IDL has ${idlData.address}, but provided ${programId.toBase58()}`
    );
  }

  return new anchor.Program(idlData, provider);
}

/**
 * Convenience function to get everything set up
 */
export function initializeClient(
  wallet: Keypair,
  cluster: keyof typeof CLUSTER_ENDPOINTS = DEFAULT_CLUSTER,
  programId: anchor.web3.PublicKey
) {
  const connection = createConnection(cluster);
  const anchorWallet = createWallet(wallet);
  const provider = createProvider(connection, anchorWallet);
  const program = getProgram(provider, programId);

  return {
    connection,
    wallet: anchorWallet,
    provider,
    program,
  };
}

