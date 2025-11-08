/**
 * AugenPay Client
 * 
 * Monolithic client class that provides a simple, unified API for all AugenPay operations.
 * This is an alternative to the service-oriented API for developers who prefer
 * object-oriented patterns.
 * 
 * @example
 * ```typescript
 * import { AugenPayClient, AUGENPAY_PROGRAM_ID } from 'augenpay-sdk';
 * 
 * const client = new AugenPayClient(keypair, 'devnet', AUGENPAY_PROGRAM_ID);
 * 
 * // Create mandate
 * const { mandate, vault } = await client.createMandate(owner, mint, {
 *   perTxLimit: 100_000000,
 *   expiryDays: 30
 * });
 * 
 * // Deposit funds
 * await client.deposit(mandate, fromTokenAccount, vault, mint, owner, 500_000000);
 * 
 * // Create allotment
 * const { allotment } = await client.createAllotment(mandate, agent, owner, {
 *   allowedAmount: 200_000000,
 *   ttlHours: 24
 * });
 * ```
 */

import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { initializeClient } from "./connection";
import { AUGENPAY_PROGRAM_ID, CLUSTER_ENDPOINTS, DEFAULT_CLUSTER } from "../config/constants";
import * as mandateService from "../services/mandate";
import * as allotmentService from "../services/allotment";
import * as redeemService from "../services/redeem";
import * as merchantService from "../services/merchant";
import {
  MandateAccount,
  AllotmentAccount,
  RedemptionTicket,
  RedeemEvent,
  AllotmentStatus,
} from "../types/accounts";
import { OrderData } from "../utils/hashing";
import { MandateConfig } from "../services/mandate";
import { AllotmentConfig } from "../services/allotment";
import { RedeemParams } from "../services/redeem";
import { TicketWithPubkey } from "../services/merchant";

export interface AugenPayClientConfig {
  cluster?: keyof typeof CLUSTER_ENDPOINTS;
  programId?: PublicKey;
  connection?: Connection;
}

/**
 * AugenPay Client - Unified API for all AugenPay operations
 */
export class AugenPayClient {
  public readonly connection: Connection;
  public readonly program: anchor.Program;
  public readonly wallet: anchor.Wallet;
  public readonly provider: anchor.AnchorProvider;
  public readonly programId: PublicKey;

  /**
   * Create a new AugenPay client
   * 
   * @param wallet - Keypair or wallet to use for signing transactions
   * @param cluster - Solana cluster (devnet, mainnet, localnet)
   * @param programId - AugenPay program ID (defaults to AUGENPAY_PROGRAM_ID)
   */
  constructor(
    wallet: Keypair,
    cluster: keyof typeof CLUSTER_ENDPOINTS = DEFAULT_CLUSTER,
    programId: PublicKey = AUGENPAY_PROGRAM_ID
  ) {
    const client = initializeClient(wallet, cluster, programId);
    this.connection = client.connection;
    this.program = client.program;
    this.wallet = client.wallet;
    this.provider = client.provider;
    this.programId = programId;
  }

  // ============================================
  // Mandate Operations
  // ============================================

  /**
   * Create a new mandate with vault
   */
  async createMandate(
    owner: PublicKey,
    mint: PublicKey,
    config: MandateConfig
  ): Promise<{ mandate: PublicKey; vault: PublicKey; nonce: anchor.BN; signature: string }> {
    return mandateService.createMandate(this.program, owner, mint, config);
  }

  /**
   * Deposit tokens into mandate vault
   */
  async deposit(
    mandate: PublicKey,
    fromTokenAccount: PublicKey,
    vault: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
    amount: number
  ): Promise<string> {
    return mandateService.depositToMandate(
      this.program,
      mandate,
      fromTokenAccount,
      vault,
      mint,
      owner,
      amount
    );
  }

  /**
   * Withdraw tokens from mandate vault
   */
  async withdraw(
    mandate: PublicKey,
    vault: PublicKey,
    toTokenAccount: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
    amount: number
  ): Promise<string> {
    return mandateService.withdrawFromMandate(
      this.program,
      mandate,
      vault,
      toTokenAccount,
      mint,
      owner,
      amount
    );
  }

  /**
   * Pause a mandate
   */
  async pauseMandate(mandate: PublicKey, owner: PublicKey): Promise<string> {
    return mandateService.pauseMandate(this.program, mandate, owner);
  }

  /**
   * Resume a paused mandate
   */
  async resumeMandate(mandate: PublicKey, owner: PublicKey): Promise<string> {
    return mandateService.resumeMandate(this.program, mandate, owner);
  }

  /**
   * Fetch mandate account data
   */
  async getMandate(mandate: PublicKey): Promise<MandateAccount> {
    return mandateService.fetchMandate(this.program, mandate);
  }

  /**
   * Display mandate information
   */
  displayMandate(mandate: MandateAccount): void {
    mandateService.displayMandateInfo(mandate);
  }

  // ============================================
  // Allotment Operations
  // ============================================

  /**
   * Create an allotment for an agent
   */
  async createAllotment(
    mandate: PublicKey,
    agent: PublicKey,
    owner: PublicKey,
    config: AllotmentConfig
  ): Promise<{ allotment: PublicKey; signature: string }> {
    return allotmentService.createAllotment(
      this.program,
      mandate,
      agent,
      owner,
      config
    );
  }

  /**
   * Modify an existing allotment
   */
  async modifyAllotment(
    mandate: PublicKey,
    allotment: PublicKey,
    owner: PublicKey,
    newAllowedAmount: number,
    newTtlHours: number
  ): Promise<string> {
    return allotmentService.modifyAllotment(
      this.program,
      mandate,
      allotment,
      owner,
      newAllowedAmount,
      newTtlHours
    );
  }

  /**
   * Revoke an allotment
   */
  async revokeAllotment(
    mandate: PublicKey,
    allotment: PublicKey,
    owner: PublicKey
  ): Promise<string> {
    return allotmentService.revokeAllotment(
      this.program,
      mandate,
      allotment,
      owner
    );
  }

  /**
   * Revoke all allotments for an agent
   */
  async revokeAgentAllotment(
    mandate: PublicKey,
    allotment: PublicKey,
    owner: PublicKey
  ): Promise<string> {
    return allotmentService.revokeAgentAllotment(
      this.program,
      mandate,
      allotment,
      owner
    );
  }

  /**
   * Fetch allotment account data
   */
  async getAllotment(allotment: PublicKey): Promise<AllotmentAccount> {
    return allotmentService.fetchAllotment(this.program, allotment);
  }

  /**
   * Get allotment status
   */
  getAllotmentStatus(allotment: AllotmentAccount): AllotmentStatus {
    return allotmentService.getAllotmentStatus(allotment);
  }

  /**
   * Display allotment information
   */
  displayAllotment(allotment: AllotmentAccount): void {
    allotmentService.displayAllotmentInfo(allotment);
  }

  // ============================================
  // Payment Operations
  // ============================================

  /**
   * Execute payment (redeem allotment)
   */
  async redeem(params: RedeemParams): Promise<{ ticket: PublicKey; signature: string; contextHash: number[] }> {
    return redeemService.redeemAllotment(this.program, params);
  }

  /**
   * Listen for redeem events
   */
  onRedeem(callback: (event: RedeemEvent) => void): number {
    return redeemService.listenForRedeemEvents(this.program, callback);
  }

  /**
   * Remove redeem event listener
   */
  async removeRedeemListener(listenerId: number): Promise<void> {
    return redeemService.removeRedeemListener(this.program, listenerId);
  }

  // ============================================
  // Merchant Operations
  // ============================================

  /**
   * Fetch a specific redemption ticket
   */
  async getTicket(ticket: PublicKey): Promise<RedemptionTicket> {
    return merchantService.fetchTicket(this.program, ticket);
  }

  /**
   * Fetch all tickets for a merchant
   */
  async getMerchantTickets(merchant: PublicKey): Promise<TicketWithPubkey[]> {
    return merchantService.fetchMerchantTickets(this.program, merchant);
  }

  /**
   * Verify a redemption ticket matches order data
   */
  async verifyTicket(
    ticket: PublicKey,
    expectedOrderData: OrderData
  ): Promise<{ valid: boolean; ticketData: RedemptionTicket }> {
    return merchantService.verifyTicket(this.program, ticket, expectedOrderData);
  }

  /**
   * Find a ticket by context hash
   */
  async findTicketByHash(
    merchant: PublicKey,
    targetHash: number[] | Buffer | Uint8Array
  ): Promise<TicketWithPubkey | null> {
    return merchantService.findTicketByHash(this.program, merchant, targetHash);
  }

  /**
   * Monitor for new tickets (polling)
   */
  async monitorTickets(
    merchant: PublicKey,
    intervalSeconds: number = 5,
    callback: (newTickets: TicketWithPubkey[]) => void
  ): Promise<NodeJS.Timeout> {
    return merchantService.monitorMerchantTickets(
      this.program,
      merchant,
      intervalSeconds,
      callback
    );
  }

  /**
   * Stop monitoring tickets
   */
  stopMonitoring(interval: NodeJS.Timeout): void {
    merchantService.stopMonitoring(interval);
  }

  /**
   * Verify and fulfill order
   */
  async verifyAndFulfill(
    ticket: PublicKey,
    expectedOrderData: OrderData,
    fulfillmentCallback: (ticketData: RedemptionTicket) => Promise<void>
  ): Promise<boolean> {
    return merchantService.verifyAndFulfillOrder(
      this.program,
      ticket,
      expectedOrderData,
      fulfillmentCallback
    );
  }

  /**
   * Display ticket information
   */
  displayTicket(ticket: RedemptionTicket): void {
    merchantService.displayTicketInfo(ticket);
  }

  /**
   * Display all merchant tickets
   */
  displayTickets(tickets: TicketWithPubkey[]): void {
    merchantService.displayMerchantTickets(tickets);
  }
}

