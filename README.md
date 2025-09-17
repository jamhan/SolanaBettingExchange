# SolBet Exchange - Solana Betting Platform

A decentralized prediction market platform built on Solana.

## Features

- **Full-stack Architecture**: React frontend with Node.js/TypeScript backend
- **Wallet Integration**: Phantom wallet support with test wallet for development
- **Matching Engine**: Continuous double auction with order book management
- **Real-time Updates**: WebSocket connections for live market data
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations
- **Prediction Markets**: Create and trade binary prediction markets

## Your Active Market

🎯 **"Will Solana one-touch $500 by end of 2025"**
- Market resolves if Solana/USD on Binance goes over $500 by the end of 2025
- Expiry: December 31st, 2025 at 23:59 UTC
- Initial Liquidity: $10,000
- Current Pricing: 50¢ YES / 50¢ NO

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL, Drizzle ORM
- **Blockchain**: Solana, Phantom Wallet
- **Real-time**: WebSocket
- **Testing**: Playwright for end-to-end testing

## Getting Started

1. Install dependencies: `npm install`
2. Set up environment variables
3. Run database migrations: `npx drizzle-kit push`
4. Start the development server: `npm run dev`

## Development

- Use the "Test Wallet" button for development without needing Phantom
- Markets can be created through the UI or API
- WebSocket provides real-time order book updates

## Project Structure

- `client/` - React frontend application
- `server/` - Express backend with API routes
- `shared/` - Shared TypeScript schemas and types
- `scripts/` - Utility scripts for seeding and simulation
- `anchor/` - Solana program skeleton (future implementation)

Built with ❤️ for decentralized prediction markets.
