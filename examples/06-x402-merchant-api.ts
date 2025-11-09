#!/usr/bin/env ts-node

/**
 * x402 Merchant API Example
 * 
 * Demonstrates a real HTTP server implementing the x402 Payment Challenge:
 * - POST /order - Receives order request, returns 402 with payment data
 * - POST /submit-proof - Receives payment proof, verifies on-chain, unlocks order
 * - GET /order/:orderId - Returns order status (locked/unlocked)
 * 
 * Usage:
 *   ts-node examples/06-x402-merchant-api.ts
 * 
 * Test with curl:
 *   # Create order
 *   curl -X POST http://localhost:3000/order \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"user@example.com","movieName":"Batman","numberOfTickets":2,"showtime":"7:00 PM"}'
 * 
 *   # Submit proof (after payment)
 *   curl -X POST http://localhost:3000/submit-proof \
 *     -H "Content-Type: application/json" \
 *     -d '{"orderId":"ORD-123","ticket":"ticket_pda_base58","orderHash":"hex_hash"}'
 * 
 *   # Check order status
 *   curl http://localhost:3000/order/ORD-123
 */

import * as http from "http";
import * as url from "url";
import { Keypair } from "@solana/web3.js";
import { AUGENPAY_PROGRAM_ID } from "../config/constants";
import { AugenPayClient } from "../core/client";
import { setupTestEnvironment, getTokenBalance, formatTokenAmount } from "../utils/tokens";
import { OrderData } from "../utils/hashing";
import {
  createPaymentChallenge,
  verifyPaymentProof,
  paymentGateMiddleware,
  fulfillOrder,
  getOrderStatus,
  getAllOrders,
  PaymentProof,
} from "../utils/payment-gate";

const PORT = 3000;

// Setup merchant (in production, load from secure storage)
let merchantKeypair: Keypair;
let merchantTokenAccount: any;
let client: AugenPayClient;
let mint: any;

async function setupMerchant() {
  console.log("🔑 Setting up merchant...");
  
  // Generate or load merchant keypair
  merchantKeypair = Keypair.generate();
  console.log(`   Merchant: ${merchantKeypair.publicKey.toBase58()}`);
  
  // Initialize client
  client = new AugenPayClient(merchantKeypair, "devnet", AUGENPAY_PROGRAM_ID);
  
  // Setup test token environment
  const { mint: testMint, tokenAccounts } = await setupTestEnvironment(
    client.connection,
    merchantKeypair,
    [merchantKeypair],
    1000_000000
  );
  
  mint = testMint;
  merchantTokenAccount = tokenAccounts[0];
  
  console.log(`   Token Account: ${merchantTokenAccount.toBase58()}`);
  console.log(`   ✅ Merchant setup complete\n`);
}

// Parse JSON body from request
function parseJSONBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// Send JSON response
function sendJSON(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

// Send error response
function sendError(res: http.ServerResponse, statusCode: number, message: string) {
  sendJSON(res, statusCode, { error: message });
}

// Handle POST /order - Create order and return 402 Payment Required
async function handleCreateOrder(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const orderRequest = await parseJSONBody(req);
    
    console.log("\n📥 Received order request:");
    console.log(JSON.stringify(orderRequest, null, 2));
    
    // Create order data
    const orderId = `ORD-${Date.now()}`;
    const orderData: OrderData = {
      orderId,
      email: orderRequest.email,
      movie: orderRequest.movieName,
      numberOfTickets: orderRequest.numberOfTickets || orderRequest.numberOfTickets,
      showtime: orderRequest.showtime,
      timestamp: Date.now(),
    };
    
    // Calculate amount (10 tokens per ticket)
    const numberOfTickets = orderRequest.numberOfTickets || 1;
    const amount = numberOfTickets * 10_000000;
    
    // Create payment challenge
    const paymentChallenge = createPaymentChallenge(
      orderId,
      orderData,
      amount,
      merchantKeypair.publicKey,
      merchantTokenAccount
    );
    
    console.log(`\n🔒 Order ${orderId} created - Payment required`);
    console.log(`   Amount: ${amount / 1e6} tokens`);
    console.log(`   Order Hash: ${paymentChallenge.paymentData.orderHash}`);
    
    // Return 402 Payment Required
    sendJSON(res, 402, paymentChallenge);
  } catch (error: any) {
    console.error("Error creating order:", error);
    sendError(res, 400, error.message || "Invalid request");
  }
}

// Handle POST /submit-proof - Verify payment proof and unlock order
async function handleSubmitProof(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const proofData: { orderId: string } & PaymentProof = await parseJSONBody(req);
    
    console.log("\n📥 Received payment proof:");
    console.log(JSON.stringify(proofData, null, 2));
    
    if (!proofData.orderId) {
      sendError(res, 400, "orderId is required");
      return;
    }
    
    // Verify payment proof on-chain
    console.log("\n🔍 Verifying payment proof on-chain...");
    const verification = await verifyPaymentProof(
      client.program,
      proofData.orderId,
      {
        ticket: proofData.ticket,
        transactionSignature: proofData.transactionSignature,
        orderHash: proofData.orderHash,
      }
    );
    
    if (verification.valid && verification.ticket) {
      console.log(`\n✅ Payment proof verified!`);
      console.log(`   Ticket: ${verification.ticket.toBase58()}`);
      console.log(`   Order ${proofData.orderId} unlocked`);
      
      sendJSON(res, 200, {
        success: true,
        message: "Payment verified - Order unlocked",
        orderId: proofData.orderId,
        ticket: verification.ticket.toBase58(),
        status: "unlocked",
      });
    } else {
      console.log(`\n❌ Payment proof verification failed: ${verification.error}`);
      sendError(res, 400, verification.error || "Payment proof verification failed");
    }
  } catch (error: any) {
    console.error("Error verifying proof:", error);
    sendError(res, 500, error.message || "Internal server error");
  }
}

// Handle GET /order/:orderId - Get order status
async function handleGetOrder(req: http.IncomingMessage, res: http.ServerResponse, orderId: string) {
  try {
    const order = getOrderStatus(orderId);
    
    if (!order) {
      sendError(res, 404, "Order not found");
      return;
    }
    
    // Check if order is gated
    const gateCheck = paymentGateMiddleware(client.program, orderId);
    
    sendJSON(res, 200, {
      orderId: order.orderId,
      status: order.status,
      paymentRequired: order.status === "pending",
      allowed: gateCheck.allowed,
      ticket: order.ticket?.toBase58(),
      proofSubmittedAt: order.proofSubmittedAt?.toISOString(),
      paymentData: {
        amount: order.paymentChallenge.paymentData.amount,
        merchant: order.paymentChallenge.paymentData.merchant,
        orderHash: order.paymentChallenge.paymentData.orderHash,
      },
    });
  } catch (error: any) {
    console.error("Error getting order:", error);
    sendError(res, 500, error.message || "Internal server error");
  }
}

// Handle GET /orders - Get all orders (merchant dashboard)
async function handleGetAllOrders(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const orders = getAllOrders();
    
    sendJSON(res, 200, {
      orders: orders.map((order) => ({
        orderId: order.orderId,
        status: order.status,
        amount: order.paymentChallenge.paymentData.amount,
        ticket: order.ticket?.toBase58(),
        proofSubmittedAt: order.proofSubmittedAt?.toISOString(),
      })),
      total: orders.length,
    });
  } catch (error: any) {
    console.error("Error getting orders:", error);
    sendError(res, 500, error.message || "Internal server error");
  }
}

// Handle POST /fulfill/:orderId - Fulfill an order
async function handleFulfillOrder(req: http.IncomingMessage, res: http.ServerResponse, orderId: string) {
  try {
    const success = fulfillOrder(orderId);
    
    if (success) {
      sendJSON(res, 200, {
        success: true,
        message: "Order fulfilled",
        orderId,
      });
    } else {
      sendError(res, 400, "Order cannot be fulfilled (not paid or already fulfilled)");
    }
  } catch (error: any) {
    console.error("Error fulfilling order:", error);
    sendError(res, 500, error.message || "Internal server error");
  }
}

// Main request handler
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const parsedUrl = url.parse(req.url || "", true);
  const pathname = parsedUrl.pathname || "";
  const method = req.method || "GET";
  
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`\n${method} ${pathname}`);
  
  try {
    // Route handlers
    if (method === "POST" && pathname === "/order") {
      await handleCreateOrder(req, res);
    } else if (method === "POST" && pathname === "/submit-proof") {
      await handleSubmitProof(req, res);
    } else if (method === "GET" && pathname === "/orders") {
      await handleGetAllOrders(req, res);
    } else if (method === "GET" && pathname.startsWith("/order/")) {
      const orderId = pathname.replace("/order/", "");
      await handleGetOrder(req, res, orderId);
    } else if (method === "POST" && pathname.startsWith("/fulfill/")) {
      const orderId = pathname.replace("/fulfill/", "");
      await handleFulfillOrder(req, res, orderId);
    } else if (pathname === "/" || pathname === "/health") {
      sendJSON(res, 200, {
        status: "ok",
        service: "x402 Merchant API",
        endpoints: {
          "POST /order": "Create order (returns 402 Payment Required)",
          "POST /submit-proof": "Submit payment proof",
          "GET /order/:orderId": "Get order status",
          "GET /orders": "Get all orders",
          "POST /fulfill/:orderId": "Fulfill order",
        },
      });
    } else {
      sendError(res, 404, "Not found");
    }
  } catch (error: any) {
    console.error("Request error:", error);
    sendError(res, 500, error.message || "Internal server error");
  }
}

// Start server
async function main() {
  console.log("🚀 Starting x402 Merchant API Server");
  console.log("=".repeat(80));
  
  await setupMerchant();
  
  const server = http.createServer(handleRequest);
  
  server.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log("\n📋 Available endpoints:");
    console.log(`   POST   http://localhost:${PORT}/order`);
    console.log(`   POST   http://localhost:${PORT}/submit-proof`);
    console.log(`   GET    http://localhost:${PORT}/order/:orderId`);
    console.log(`   GET    http://localhost:${PORT}/orders`);
    console.log(`   POST   http://localhost:${PORT}/fulfill/:orderId`);
    console.log(`   GET    http://localhost:${PORT}/health`);
    console.log("\n💡 Test with curl commands shown in file header");
    console.log("=".repeat(80));
  });
  
  server.on("error", (error: any) => {
    if (error.code === "EADDRINUSE") {
      console.error(`\n❌ Port ${PORT} is already in use`);
      console.error("   Please stop the other server or change the PORT constant");
    } else {
      console.error("\n❌ Server error:", error);
    }
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});

