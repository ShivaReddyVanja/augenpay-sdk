import { createHash } from "crypto";

/**
 * Order data interface (merchant-defined)
 */
export interface OrderData {
  email?: string;
  productName?: string;
  quantity?: number;
  price?: number;
  timestamp?: number;
  orderId?: string;
  [key: string]: any; // Allow custom fields
}

/**
 * Create SHA256 hash from order data
 * This hash will be stored on-chain in the RedemptionTicket
 */
export function createContextHash(orderData: OrderData): Buffer {
  // Normalize the data by sorting keys for consistent hashing
  const normalized = JSON.stringify(orderData, Object.keys(orderData).sort());
  
  const hash = createHash("sha256")
    .update(normalized)
    .digest();
  
  return hash;
}

/**
 * Create context hash and return as array (for Anchor)
 */
export function createContextHashArray(orderData: OrderData): number[] {
  const hash = createContextHash(orderData);
  return Array.from(hash);
}

/**
 * Verify a context hash matches order data
 */
export function verifyContextHash(
  orderData: OrderData,
  expectedHash: Buffer | number[] | Uint8Array
): boolean {
  const computedHash = createContextHash(orderData);
  const expectedBuffer = Buffer.isBuffer(expectedHash)
    ? expectedHash
    : Buffer.from(expectedHash);
  
  return computedHash.equals(expectedBuffer);
}

/**
 * Convert hash to hex string for display
 */
export function hashToHex(hash: Buffer | number[] | Uint8Array): string {
  const buffer = Buffer.isBuffer(hash) ? hash : Buffer.from(hash);
  return buffer.toString("hex");
}

/**
 * Convert hex string back to hash array
 */
export function hexToHashArray(hex: string): number[] {
  return Array.from(Buffer.from(hex, "hex"));
}

/**
 * Pretty print order data and hash
 */
export function displayOrderHash(orderData: OrderData, hash: number[] | Buffer) {
  console.log("\n📋 Order Data:");
  console.log(JSON.stringify(orderData, null, 2));
  console.log("\n🔐 Context Hash:");
  console.log(hashToHex(hash));
}

