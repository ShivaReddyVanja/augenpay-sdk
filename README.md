# AugenPay SDK

TypeScript SDK for interacting with the AugenPay Payment Protocol on Solana.

## Overview

AugenPay enables **delegated payments with on-chain verification**. Users can authorize agents to make payments on their behalf, and merchants can independently verify payments using on-chain data.

## Features

- ✅ **Mandate Management** - Create and manage payment mandates with vaults
- ✅ **Agent Delegation** - Create spending allotments for agents
- ✅ **Payment Execution** - Agents redeem allotments to pay merchants
- ✅ **Hash Verification** - Order data hashed and stored on-chain
- ✅ **Merchant Discovery** - Merchants can query all their payment tickets
- ✅ **Security Controls** - Pause/resume, limits, expiration

## Installation

```bash
cd client
yarn install
```

## Quick Start

### Run the Sandbox Demo

```bash
yarn sandbox
```

This will demonstrate the complete payment flow:
1. User creates mandate
2. User deposits funds
3. User creates allotment for agent
4. Agent buys movie tickets
5. Merchant verifies payment

### Basic Usage

#### Option 1: Client Class (Recommended for Simplicity)

```typescript
import { AugenPayClient, AUGENPAY_PROGRAM_ID } from "augenpay-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";

// Initialize client
const client = new AugenPayClient(userKeypair, "devnet", AUGENPAY_PROGRAM_ID);

// Create mandate
const { mandate, vault } = await client.createMandate(
  userKeypair.publicKey,
  mintPublicKey,
  {
    perTxLimit: 100_000000, // 100 tokens
    expiryDays: 30
  }
);

// Deposit funds
await client.deposit(
  mandate,
  userTokenAccount,
  vault,
  mint,
  userKeypair.publicKey,
  500_000000 // 500 tokens
);

// Create allotment for agent
const { allotment } = await client.createAllotment(
  mandate,
  agentPublicKey,
  userKeypair.publicKey,
  {
    allowedAmount: 200_000000,
    ttlHours: 24
  }
);

// Agent executes payment
const orderData = {
  orderId: "ORD-12345",
  customerEmail: "user@example.com",
  items: [{ productId: "PROD-1", quantity: 2, price: 10_000000 }],
  totalAmount: 20_000000,
  timestamp: Date.now(),
};

const { ticket } = await client.redeem({
  allotment,
  mandate,
  agent: agentKeypair.publicKey,
  merchant: merchantPublicKey,
  merchantTokenAccount,
  vault,
  mint,
  amount: 20_000000,
  orderData
});

// Merchant verifies payment
const { valid } = await client.verifyTicket(ticket, orderData);
```

#### Option 2: Service-Oriented API (More Flexible)

```typescript
import {
  initializeClient,
  mandateService,
  allotmentService,
  redeemService,
  merchantService,
  AUGENPAY_PROGRAM_ID
} from "augenpay-sdk";

// Initialize
const { program } = initializeClient(
  userKeypair,
  "devnet",
  AUGENPAY_PROGRAM_ID
);

// Create mandate
const { mandate, vault } = await mandateService.createMandate(
  program,
  userKeypair.publicKey,
  mintPublicKey,
  {
    perTxLimit: 100_000000,
    expiryDays: 30
  }
);

// ... (same pattern for other operations)
```

## Project Structure

```
client/
├── config/
│   └── constants.ts       # Program ID, cluster config
├── core/
│   ├── connection.ts      # Solana connection setup
│   ├── pda.ts             # PDA derivation
│   └── wallet.ts          # Keypair management
├── services/
│   ├── mandate.ts         # Mandate operations
│   ├── allotment.ts       # Allotment operations
│   ├── redeem.ts          # Payment execution
│   └── merchant.ts        # Merchant verification
├── utils/
│   ├── tokens.ts          # Token utilities
│   └── hashing.ts         # Context hash utilities
├── sandbox.ts             # Complete demo
└── index.ts               # SDK exports
```

## Payment Flow

### 1. User Setup
```typescript
// Create mandate
const { mandate, vault } = await mandateService.createMandate(...);

// Deposit funds
await mandateService.depositToMandate(...);

// Create agent allotment
const { allotment } = await allotmentService.createAllotment(...);
```

### 2. Agent Payment
```typescript
// Agent submits order to merchant
// Merchant returns: { paymentAddress, orderHash, amount }

// Agent executes payment
const { ticket } = await redeemService.redeemAllotment(
  program,
  {
    allotment,
    mandate,
    agent: agentKeypair.publicKey,
    merchant: merchantPublicKey,
    merchantTokenAccount,
    vault,
    mint,
    amount,
    orderData // Will be hashed
  }
);
```

### 3. Merchant Verification
```typescript
// Option 1: Direct ticket verification
const { valid, ticketData } = await merchantService.verifyTicket(
  program,
  ticketPDA,
  expectedOrderData
);

// Option 2: Query all merchant tickets
const tickets = await merchantService.fetchMerchantTickets(
  program,
  merchantPublicKey
);

// Option 3: Find by hash
const ticket = await merchantService.findTicketByHash(
  program,
  merchantPublicKey,
  targetHash
);
```

## Order Hashing

Orders are hashed using SHA256 before being stored on-chain. You define your own order data structure:

```typescript
import { createContextHashArray, hashToHex, OrderData } from "@augenpay/sdk";

// Define your order data structure (merchant-defined)
const orderData: OrderData = {
  orderId: "ORD-12345",
  customerEmail: "user@example.com",
  items: [
    { productId: "PROD-001", quantity: 2, price: 50 }
  ],
  totalAmount: 100,
  timestamp: Date.now()
};

// Create hash for on-chain storage
const hash = createContextHashArray(orderData);
const hashHex = hashToHex(hash);

// hash = [array of 32 bytes] - use this in redeem()
// hashHex = "7a8b9c..." (hex string for display)
```

Custom order types:

```typescript
import { createContextHashArray } from "./utils/hashing";

const orderData = {
  orderId: "ORD-12345",
  items: [...],
  total: 100,
  // any custom fields
};

const hash = createContextHashArray(orderData);
```

## API Reference

### Client Class (Recommended)

The `AugenPayClient` class provides a unified, object-oriented API:

```typescript
const client = new AugenPayClient(keypair, 'devnet', AUGENPAY_PROGRAM_ID);

// Mandate operations
await client.createMandate(owner, mint, config);
await client.deposit(mandate, from, vault, mint, owner, amount);
await client.withdraw(mandate, vault, to, mint, owner, amount);
await client.pauseMandate(mandate, owner);
await client.resumeMandate(mandate, owner);
const mandate = await client.getMandate(mandateAddress);

// Allotment operations
await client.createAllotment(mandate, agent, owner, config);
await client.modifyAllotment(mandate, allotment, owner, amount, ttl);
await client.revokeAllotment(mandate, allotment, owner);
const allotment = await client.getAllotment(allotmentAddress);

// Payment operations
await client.redeem(params);
client.onRedeem(callback);

// Merchant operations
await client.getTicket(ticket);
await client.getMerchantTickets(merchant);
await client.verifyTicket(ticket, orderData);
await client.findTicketByHash(merchant, hash);
```

See [examples/00-client-example.ts](./examples/00-client-example.ts) for a complete example.

### Mandate Service

```typescript
// Create mandate
createMandate(program, owner, mint, config)

// Deposit funds
depositToMandate(program, mandate, from, vault, mint, owner, amount)

// Withdraw funds
withdrawFromMandate(program, mandate, vault, to, mint, owner, amount)

// Pause/resume
pauseMandate(program, mandate, owner)
resumeMandate(program, mandate, owner)

// Fetch data
fetchMandate(program, mandate)
displayMandateInfo(mandateData)
```

### Allotment Service

```typescript
// Create allotment
createAllotment(program, mandate, agent, owner, config)

// Modify allotment
modifyAllotment(program, mandate, allotment, owner, newAmount, newTtl)

// Revoke allotment
revokeAllotment(program, mandate, allotment, owner)

// Fetch data
fetchAllotment(program, allotment)
displayAllotmentInfo(allotmentData)
```

### Redeem Service

```typescript
// Execute payment (generic - works for any use case)
redeemAllotment(program, params)

// Event listening
listenForRedeemEvents(program, callback)
removeRedeemListener(program, listenerId)
```

### Merchant Service

```typescript
// Fetch tickets
fetchTicket(program, ticket)
fetchMerchantTickets(program, merchant)

// Verify ticket
verifyTicket(program, ticket, expectedOrderData)

// Search
findTicketByHash(program, merchant, targetHash)

// Monitor
monitorMerchantTickets(program, merchant, intervalSeconds, callback)
stopMonitoring(interval)

// Display
displayTicketInfo(ticketData)
displayMerchantTickets(tickets)
```

## Configuration

Edit `config/constants.ts`:

```typescript
export const AUGENPAY_PROGRAM_ID = new PublicKey(
  "6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp"
);

export const DEFAULT_CLUSTER = "devnet"; // or "mainnet"
```

## Development

```bash
# Build TypeScript
yarn build

# Run sandbox
yarn dev

# Clean build
yarn clean
```

## Examples

### Movie Tickets
See `sandbox.ts` for complete example.

### E-commerce
```typescript
const orderData = {
  orderId: "ORD-12345",
  customerEmail: "customer@example.com",
  items: [
    { productId: "PROD-1", quantity: 2, price: 25_000000 }
  ],
  totalAmount: 50_000000,
  shippingAddress: "123 Main St",
  timestamp: Date.now(),
};

const { ticket } = await redeemService.redeemAllotment(
  program,
  {
    allotment,
    mandate,
    agent: agentKeypair.publicKey,
    merchant: merchantPublicKey,
    merchantTokenAccount,
    vault,
    mint,
    amount: orderData.totalAmount,
    orderData
  }
);
```

### Merchant Integration
```typescript
// Real-time monitoring
const interval = await merchantService.monitorMerchantTickets(
  program,
  merchantPublicKey,
  5, // check every 5 seconds
  (newTickets) => {
    console.log(`Received ${newTickets.length} payment(s)`);
    newTickets.forEach(async (ticket) => {
      // Verify and fulfill order
      const { valid } = await merchantService.verifyTicket(
        program,
        ticket.pubkey,
        expectedOrderData
      );
      
      if (valid) {
        await fulfillOrder(ticket.account);
      }
    });
  }
);

// Stop when done
merchantService.stopMonitoring(interval);
```

## Testing

The SDK includes a complete test flow in `sandbox.ts` that:
- Creates test tokens
- Demonstrates full payment flow
- Verifies on-chain data
- Tests all features

Run it with:
```bash
yarn sandbox
```

## Network Configuration

### Devnet (Default)
```typescript
const { program } = await initializeClient(
  keypair,
  "devnet",
  AUGENPAY_PROGRAM_ID
);
```

### Mainnet
```typescript
const { program } = await initializeClient(
  keypair,
  "mainnet",
  AUGENPAY_PROGRAM_ID
);
```

### Localnet
```typescript
const { program } = await initializeClient(
  keypair,
  "localnet",
  AUGENPAY_PROGRAM_ID
);
```

## Security Notes

1. **Never expose private keys** - Use secure key management
2. **Validate all inputs** - Especially amounts and addresses
3. **Verify order data** - Always check hash matches before fulfilling
4. **Set reasonable limits** - Use per-tx and allotment limits
5. **Monitor mandates** - Watch for suspicious activity

## Support

- Program ID: `6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp`
- Network: Solana Devnet
- Explorer: https://explorer.solana.com/address/6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp?cluster=devnet

## License

MIT

