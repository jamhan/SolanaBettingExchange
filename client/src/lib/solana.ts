import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Use environment variable for RPC endpoint, fallback to devnet
const RPC_ENDPOINT = import.meta.env.VITE_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';

export const connection = new Connection(RPC_ENDPOINT, 'confirmed');

export const BETTING_PROGRAM_ID = new PublicKey('11111111111111111111111111111111'); // Placeholder

export interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export async function getBalance(publicKey: PublicKey): Promise<number> {
  try {
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
}

export async function signMessage(message: string, wallet: WalletAdapter): Promise<string> {
  if (!wallet.publicKey || !wallet.connected) {
    throw new Error('Wallet not connected');
  }

  try {
    const messageBytes = new TextEncoder().encode(message);
    const signature = await wallet.signMessage(messageBytes);
    return Buffer.from(signature).toString('hex');
  } catch (error) {
    console.error('Error signing message:', error);
    throw error;
  }
}

export async function createBettingMarket(
  wallet: WalletAdapter,
  marketData: {
    title: string;
    description: string;
    expiry: Date;
  }
): Promise<string> {
  if (!wallet.publicKey || !wallet.connected) {
    throw new Error('Wallet not connected');
  }

  // Placeholder for Anchor program interaction
  // This would typically interact with the deployed Anchor program
  console.log('Creating betting market:', marketData);
  
  // Return mock transaction signature
  return 'mock_transaction_signature';
}

export async function placeBet(
  wallet: WalletAdapter,
  marketId: string,
  side: 'YES' | 'NO',
  amount: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.connected) {
    throw new Error('Wallet not connected');
  }

  // Placeholder for Anchor program interaction
  console.log('Placing bet:', { marketId, side, amount });
  
  // Return mock transaction signature
  return 'mock_bet_transaction_signature';
}
