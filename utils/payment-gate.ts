import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { OrderData, createContextHashArray, hashToHex, verifyContextHash } from "./hashing";
import { fetchTicket, findTicketByHash } from "../services/merchant";

/**
 * Payment challenge data returned in 402 Payment Required response
 */
export interface PaymentChallenge {
  status: 402;
  paymentRequired: true;
  paymentData: {
    amount: number;
    merchant: string;
    merchantTokenAccount: string;
    orderHash: string;
    orderData: OrderData;
    orderId?: string;
  };
}

/**
 * Payment proof submitted by agent
 */
export interface PaymentProof {
  ticket?: string; // Ticket PDA as base58 string
  transactionSignature?: string; // Transaction signature
  orderHash?: string; // Order hash for verification
}

/**
 * Order status stored in merchant system
 */
export interface OrderStatus {
  orderId: string;
  orderData: OrderData;
  paymentChallenge: PaymentChallenge;
  status: "pending" | "paid" | "fulfilled";
  ticket?: PublicKey;
  proofSubmittedAt?: Date;
}

/**
 * In-memory order store (in production, use a database)
 */
class OrderStore {
  private orders: Map<string, OrderStatus> = new Map();

  createOrder(orderId: string, orderData: OrderData, paymentChallenge: PaymentChallenge): OrderStatus {
    const orderStatus: OrderStatus = {
      orderId,
      orderData,
      paymentChallenge,
      status: "pending",
    };
    this.orders.set(orderId, orderStatus);
    return orderStatus;
  }

  getOrder(orderId: string): OrderStatus | undefined {
    return this.orders.get(orderId);
  }

  updateOrder(orderId: string, updates: Partial<OrderStatus>): OrderStatus | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    
    const updated = { ...order, ...updates };
    this.orders.set(orderId, updated);
    return updated;
  }

  getAllOrders(): OrderStatus[] {
    return Array.from(this.orders.values());
  }
}

// Global order store instance
const orderStore = new OrderStore();

/**
 * Create a payment challenge (402 Payment Required response)
 * This is what the merchant returns when an agent requests a resource
 */
export function createPaymentChallenge(
  orderId: string,
  orderData: OrderData,
  amount: number,
  merchant: PublicKey,
  merchantTokenAccount: PublicKey
): PaymentChallenge {
  const orderHash = hashToHex(createContextHashArray(orderData));

  const challenge: PaymentChallenge = {
    status: 402,
    paymentRequired: true,
    paymentData: {
      amount,
      merchant: merchant.toBase58(),
      merchantTokenAccount: merchantTokenAccount.toBase58(),
      orderHash,
      orderData,
      orderId,
    },
  };

  // Store the order in the order store
  orderStore.createOrder(orderId, orderData, challenge);

  return challenge;
}

/**
 * Verify payment proof on-chain
 * Checks if the ticket exists and matches the order hash
 */
export async function verifyPaymentProof(
  program: anchor.Program,
  orderId: string,
  proof: PaymentProof
): Promise<{ valid: boolean; ticket?: PublicKey; error?: string }> {
  const order = orderStore.getOrder(orderId);
  if (!order) {
    return { valid: false, error: "Order not found" };
  }

  if (order.status === "paid" || order.status === "fulfilled") {
    return { valid: false, error: "Order already paid" };
  }

  // If ticket PDA is provided, verify it directly
  if (proof.ticket) {
    try {
      const ticketPubkey = new PublicKey(proof.ticket);
      const ticketData = await fetchTicket(program, ticketPubkey);

      // Verify the ticket belongs to the merchant
      const merchantPubkey = new PublicKey(order.paymentChallenge.paymentData.merchant);
      if (!ticketData.merchant.equals(merchantPubkey)) {
        return { valid: false, error: "Ticket does not belong to this merchant" };
      }

      // Verify the hash matches
      const isValid = verifyContextHash(
        order.orderData,
        ticketData.contextHash
      );

      if (isValid) {
        // Update order status
        orderStore.updateOrder(orderId, {
          status: "paid",
          ticket: ticketPubkey,
          proofSubmittedAt: new Date(),
        });

        return { valid: true, ticket: ticketPubkey };
      } else {
        return { valid: false, error: "Order hash mismatch" };
      }
    } catch (error: any) {
      return { valid: false, error: `Invalid ticket: ${error.message}` };
    }
  }

  // If order hash is provided, search for matching ticket
  if (proof.orderHash) {
    try {
      const merchantPubkey = new PublicKey(order.paymentChallenge.paymentData.merchant);
      const hashArray = Array.from(Buffer.from(proof.orderHash, "hex"));
      
      const ticket = await findTicketByHash(program, merchantPubkey, hashArray);
      
      if (ticket) {
        // Verify amount matches
        const expectedAmount = order.paymentChallenge.paymentData.amount;
        if (ticket.account.amount.toNumber() !== expectedAmount) {
          return { valid: false, error: "Payment amount mismatch" };
        }

        // Update order status
        orderStore.updateOrder(orderId, {
          status: "paid",
          ticket: ticket.pubkey,
          proofSubmittedAt: new Date(),
        });

        return { valid: true, ticket: ticket.pubkey };
      } else {
        return { valid: false, error: "No matching ticket found on-chain" };
      }
    } catch (error: any) {
      return { valid: false, error: `Error searching for ticket: ${error.message}` };
    }
  }

  return { valid: false, error: "No valid proof provided" };
}

/**
 * Check if an order has been paid
 */
export function isOrderPaid(orderId: string): boolean {
  const order = orderStore.getOrder(orderId);
  return order?.status === "paid" || order?.status === "fulfilled" || false;
}

/**
 * Get order status
 */
export function getOrderStatus(orderId: string): OrderStatus | undefined {
  return orderStore.getOrder(orderId);
}

/**
 * Mark order as fulfilled
 */
export function fulfillOrder(orderId: string): boolean {
  const order = orderStore.getOrder(orderId);
  if (!order || order.status !== "paid") {
    return false;
  }
  orderStore.updateOrder(orderId, { status: "fulfilled" });
  return true;
}

/**
 * Payment gate middleware function
 * Use this to gate API endpoints behind payment verification
 */
export function paymentGateMiddleware(
  program: anchor.Program,
  orderId: string
): { allowed: boolean; order?: OrderStatus; error?: string } {
  const order = orderStore.getOrder(orderId);
  
  if (!order) {
    return { allowed: false, error: "Order not found" };
  }

  if (order.status === "pending") {
    return { allowed: false, error: "Payment required", order };
  }

  if (order.status === "paid" || order.status === "fulfilled") {
    return { allowed: true, order };
  }

  return { allowed: false, error: "Unknown order status" };
}

/**
 * Get all orders (for merchant dashboard)
 */
export function getAllOrders(): OrderStatus[] {
  return orderStore.getAllOrders();
}

