# AugenPay SDK - Terminology Guide

This document explains complex terms and concepts used throughout the AugenPay SDK. Use this as a reference when working with the SDK.

---

## Core Concepts

### **Mandate**
A **mandate** is a user's authorization for delegated payments. Think of it as a "payment wallet" that:
- Stores tokens in a secure vault
- Has spending limits and expiry dates
- Can be paused/resumed by the owner
- Allows multiple agents to make payments on behalf of the user

**Example:** A user creates a mandate with 1000 USDC, allowing agents to make payments up to 100 USDC per transaction.

---

### **Allotment**
An **allotment** is a spending authorization given to a specific agent. It:
- Belongs to a mandate
- Authorizes one agent to spend up to a certain amount
- Has a time-to-live (TTL) expiry
- Can be revoked by the mandate owner
- Tracks how much has been spent

**Example:** User creates an allotment for Agent A with 200 USDC limit, valid for 24 hours.

---

### **Agent**
An **agent** is an authorized party that can execute payments on behalf of the mandate owner. Agents:
- Are assigned to specific allotments
- Can redeem allotments to pay merchants
- Must match the agent specified in the allotment
- Cannot exceed the allotment's spending limits

**Example:** A payment service or automated system that makes purchases for users.

---

### **Merchant**
A **merchant** is the recipient of payments. Merchants:
- Receive tokens when agents redeem allotments
- Can query all their payment tickets
- Verify payments using context hashes
- Fulfill orders after payment verification

**Example:** An e-commerce store, restaurant, or service provider.

---

### **Vault**
A **vault** is an Associated Token Account (ATA) that stores tokens for a mandate. It:
- Is owned by the mandate PDA
- Holds the actual tokens (e.g., USDC)
- Is the source of funds for all redemptions
- Tracks total deposits

**Example:** A mandate's vault holds 500 USDC, which agents can spend from.

---

### **Redemption**
A **redemption** is the act of an agent using an allotment to pay a merchant. It:
- Transfers tokens from vault to merchant
- Creates a redemption ticket (proof of payment)
- Updates allotment spent amount
- Increments redemption count
- Emits a RedeemEvent

**Example:** Agent redeems 20 USDC from an allotment to pay a merchant for movie tickets.

---

## Account Types

### **MandateAccount**
On-chain account storing mandate configuration and state.

**Fields:**
- `owner`: PublicKey of the user who created the mandate
- `mandateBump`: Bump seed for the PDA derivation
- `nonce`: Unique identifier used in PDA derivation
- `tokenMint`: The token type (e.g., USDC mint address)
- `vault`: Associated Token Account address where tokens are stored
- `perTxLimit`: Maximum amount per single transaction
- `expiry`: Unix timestamp when mandate expires
- `paused`: Whether the mandate is currently paused
- `totalDeposited`: Cumulative amount deposited into vault

---

### **AllotmentAccount**
On-chain account storing agent spending authorization and usage.

**Fields:**
- `mandate`: PublicKey of the parent mandate
- `agent`: PublicKey of the authorized agent
- `allowedAmount`: Maximum amount agent can spend
- `spentAmount`: Amount already spent by agent
- `ttl`: Time-to-live expiry timestamp
- `revoked`: Whether this allotment has been revoked
- `redemptionCount`: Number of redemptions made (used for ticket PDA derivation)

---

### **RedemptionTicket**
On-chain account serving as proof of payment. Created for each redemption.

**Fields:**
- `allotment`: PublicKey of the allotment that was redeemed
- `merchant`: PublicKey of the merchant who received payment
- `contextHash`: SHA256 hash of order/context data (32 bytes)
- `amount`: Amount paid in token base units
- `timestamp`: Unix timestamp when payment was executed

**Purpose:** Merchants can query these tickets to verify payments independently.

---

## Solana-Specific Terms

### **PDA (Program Derived Address)**
A **PDA** is a special type of account address that:
- Is deterministically derived from seeds
- Is owned by a program (not a private key)
- Can sign transactions on behalf of the program
- Is used for mandate and ticket accounts

**Example:** Mandate PDA is derived from: `["mandate", owner_pubkey, nonce]`

---

### **Bump Seed**
A **bump seed** is a single byte (0-255) used to ensure a PDA derivation is valid. It's the highest value that produces a valid PDA (not on the ed25519 curve).

**Usage:** Stored in MandateAccount to recreate the PDA without trying all 256 possibilities.

---

### **Nonce**
A **nonce** is a unique number used to create multiple mandates for the same owner. It:
- Allows one user to have multiple mandates
- Is included in the PDA derivation seeds
- Is typically generated from timestamp

**Example:** User creates Mandate #1 with nonce=12345, Mandate #2 with nonce=67890.

---

### **ATA (Associated Token Account)**
An **ATA** is a standard way to store tokens for a wallet or PDA. It:
- Is deterministically derived from owner + mint
- Follows SPL Token standard
- Is the standard way to hold tokens on Solana

**Example:** Vault is an ATA owned by the mandate PDA, holding USDC tokens.

---

### **Token Base Units**
**Token base units** are the smallest denomination of a token. For tokens with 6 decimals:
- 1 USDC = 1,000,000 base units
- 100 USDC = 100_000000 base units

**Why:** Solana stores all amounts as integers to avoid floating-point precision issues.

---

### **Context Hash**
A **context hash** is a SHA256 hash of order/context data. It:
- Is 32 bytes (256 bits)
- Uniquely identifies an order/payment
- Is stored in RedemptionTicket for verification
- Allows merchants to verify payment matches their order

**Example:** Merchant creates order data, hashes it, agent includes hash in redemption, merchant verifies hash matches.

---

## Status Types

### **AllotmentStatus**
The current state of an allotment:
- `"active"`: Allotment is active and can be used
- `"revoked"`: Allotment has been revoked by owner
- `"expired"`: Allotment has passed its TTL
- `"fully_spent"`: Allotment has been fully spent

---

### **MandateStatus**
The current state of a mandate:
- `"active"`: Mandate is active and operational
- `"paused"`: Mandate is paused (no allotments/redeems allowed)
- `"expired"`: Mandate has passed its expiry date

---

## Technical Terms

### **Redemption Count**
The **redemption count** is a counter that increments with each redemption from an allotment. It:
- Starts at 0 for new allotments
- Increments after each successful redemption
- Is used in ticket PDA derivation to ensure uniqueness
- Allows multiple redemptions to the same merchant

**Why needed:** Without it, you could only redeem once per merchant per allotment (PDA collision).

---

### **TTL (Time-To-Live)**
**TTL** is the expiry timestamp for an allotment. After this time:
- The allotment cannot be used for new redemptions
- Existing redemptions are still valid (tickets remain)
- The allotment status becomes "expired"

**Format:** Unix timestamp in seconds

---

### **Per-Tx Limit**
The **per-tx limit** is the maximum amount allowed in a single transaction. It:
- Is set at mandate creation
- Applies to all redemptions from that mandate
- Prevents large unauthorized payments
- Is separate from allotment limits

**Example:** Mandate has per-tx limit of 100 USDC, so no single redemption can exceed 100 USDC.

---

### **RedeemEvent**
A **RedeemEvent** is an on-chain event emitted when a redemption occurs. It contains:
- Allotment, merchant, and agent addresses
- Context hash and amount
- Timestamp

**Purpose:** Merchants can listen for these events to detect new payments in real-time.

---

### **Discriminator**
A **discriminator** is an 8-byte identifier at the start of Anchor account data. It:
- Identifies the account type
- Is automatically added by Anchor
- Is used in account filtering/queries

**Example:** All MandateAccount instances start with the same 8-byte discriminator.

---

### **Memcmp (Memory Comparison)**
**Memcmp** is a filter used in `getProgramAccounts` to match account data at specific byte offsets. It:
- Allows querying accounts by field values
- Requires knowing the byte offset of the field
- Is used to find all mandates for a user or tickets for a merchant

**Example:** Filter mandates where owner field (offset 8) matches a specific public key.

---

## Common Patterns

### **PDA Derivation**
The process of creating a deterministic address from seeds:
```typescript
const [pda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("mandate"), owner.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
  programId
);
```

---

### **Account Fetching**
Retrieving on-chain account data:
```typescript
const account = await program.account.allotmentAccount.fetch(allotmentPubkey);
```

---

### **Event Listening**
Subscribing to on-chain events:
```typescript
const listenerId = program.addEventListener("RedeemEvent", (event) => {
  // Handle event
});
```

---

## Quick Reference

| Term | Type | Description |
|------|------|-------------|
| Mandate | Concept | User's payment authorization wallet |
| Allotment | Concept | Agent spending authorization |
| Agent | Role | Authorized payment executor |
| Merchant | Role | Payment recipient |
| Vault | Account | Token storage (ATA) |
| Redemption | Action | Using allotment to pay merchant |
| PDA | Technical | Program Derived Address |
| Bump | Technical | Single byte for PDA validity |
| Nonce | Technical | Unique identifier for mandates |
| ATA | Technical | Associated Token Account |
| Context Hash | Technical | SHA256 hash of order data |
| Redemption Count | Technical | Counter for ticket uniqueness |
| TTL | Technical | Time-to-live expiry |
| Per-Tx Limit | Technical | Maximum per transaction |

---

## Further Reading

- [Solana Program Library (SPL) Token](https://spl.solana.com/token)
- [Anchor Framework Documentation](https://www.anchor-lang.com/)
- [Solana Accounts and PDAs](https://docs.solana.com/developing/programming-model/accounts)

