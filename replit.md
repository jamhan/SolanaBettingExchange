# Overview

SolBet Exchange is a decentralized prediction market platform built on Solana. The application allows users to create and trade binary prediction markets (YES/NO positions) on various events, from cryptocurrency price movements to technology announcements. Users can place limit or market orders, manage their portfolio positions, and track trading activity through a comprehensive dashboard interface.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives for consistent, accessible interface elements
- **Styling**: Tailwind CSS with custom design tokens and dark theme support
- **State Management**: TanStack Query for server state management with built-in caching and synchronization
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: WebSocket integration for live order book updates and market data

## Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ES modules for type safety and modern JavaScript features
- **API Design**: RESTful API endpoints for user management, market operations, and order processing
- **Real-time Features**: WebSocket server for live market data streaming and order book updates
- **Order Matching**: Custom matching engine for processing limit and market orders with proper price-time priority

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection**: Neon serverless PostgreSQL for scalable cloud database hosting
- **Schema Management**: Drizzle Kit for database migrations and schema evolution
- **Session Storage**: PostgreSQL-backed session storage using connect-pg-simple

## Database Schema Design
- **Users**: Wallet address-based authentication with balance tracking
- **Markets**: Binary prediction markets with expiry dates, pricing, and resolution status
- **Orders**: Limit and market orders with fill tracking and status management
- **Trades**: Executed trade records linking buy/sell orders with pricing and volume
- **Positions**: User position tracking per market for portfolio management

## Authentication and Authorization
- **Wallet Integration**: Solana wallet connection using Phantom wallet adapter
- **Wallet-based Auth**: Public key-based user identification without traditional passwords
- **Session Management**: Server-side session storage for maintaining user state
- **Message Signing**: Cryptographic message signing for secure wallet verification

## Trading Engine
- **Order Book Management**: Separate order books for YES and NO sides of each market
- **Price Discovery**: Automated market pricing based on order book depth and recent trades
- **Order Matching**: FIFO matching algorithm with price-time priority for fair execution
- **Position Tracking**: Real-time position updates and profit/loss calculations

# External Dependencies

## Blockchain Integration
- **Solana Web3.js**: Core Solana blockchain interaction library for wallet integration and transaction processing
- **Phantom Wallet**: Primary wallet adapter for user authentication and transaction signing

## Database and Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting for scalable data storage
- **Drizzle ORM**: Type-safe database toolkit for schema management and queries

## UI and Styling
- **Radix UI**: Headless component primitives for building accessible UI components
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide React**: Icon library for consistent iconography

## Development Tools
- **Vite**: Fast build tool with hot module replacement for development
- **TypeScript**: Static type checking for improved code reliability
- **ESBuild**: Fast JavaScript bundler for production builds

## Real-time Communication
- **WebSocket (ws)**: Real-time bidirectional communication for live market updates
- **TanStack Query**: Intelligent data fetching and caching for optimal user experience

## Mathematical Precision
- **Decimal.js**: Arbitrary precision decimal arithmetic for accurate financial calculations
- **Date-fns**: Date manipulation library for time-based market operations