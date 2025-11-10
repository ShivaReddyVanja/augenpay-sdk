/**
 * Session management for CLI
 * Persists last used PDAs across commands
 */

import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";

const SESSION_FILE = path.join(process.cwd(), ".augenpay-session.json");

export interface SessionData {
  lastMandate?: string;
  lastVault?: string;
  lastAllotment?: string;
  lastTicket?: string;
  lastMint?: string;
  lastUserTokenAccount?: string;
  lastMerchantTokenAccount?: string;
}

/**
 * Load session data
 */
export function loadSession(): SessionData {
  if (!fs.existsSync(SESSION_FILE)) {
    return {};
  }

  try {
    const data = fs.readFileSync(SESSION_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.warn(chalk.yellow("⚠️  Could not load session file, starting fresh"));
    return {};
  }
}

/**
 * Save session data
 */
export function saveSession(data: SessionData): void {
  try {
    const existing = loadSession();
    const updated = { ...existing, ...data };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(updated, null, 2));
  } catch (error) {
    console.warn(chalk.yellow("⚠️  Could not save session file"));
  }
}

/**
 * Update a single session field
 */
export function updateSession(field: keyof SessionData, value: string): void {
  const session = loadSession();
  session[field] = value;
  saveSession(session);
}

/**
 * Get a session value
 */
export function getSession(field: keyof SessionData): string | undefined {
  const session = loadSession();
  return session[field];
}

/**
 * Clear session
 */
export function clearSession(): void {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
  }
}

