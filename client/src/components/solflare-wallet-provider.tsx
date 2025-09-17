import { ReactNode } from 'react';
import { SolflareProvider } from './solflare-wallet-connector';
import { clusterApiUrl } from '@solana/web3.js';

interface SolflareWalletProviderProps {
  children: ReactNode;
}

export function SolflareWalletProvider({ children }: SolflareWalletProviderProps) {
  // Use mainnet for production, devnet for development
  const endpoint = import.meta.env.VITE_SOLANA_NETWORK === 'mainnet' 
    ? clusterApiUrl('mainnet-beta')
    : clusterApiUrl('devnet');

  return (
    <SolflareProvider endpoint={endpoint}>
      {children}
    </SolflareProvider>
  );
}