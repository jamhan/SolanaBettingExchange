import { db } from "../server/db";
import { storage } from "../server/storage";

interface SeedMarket {
  title: string;
  description: string;
  expiryDays: number;
  creatorWallet: string;
  initialLiquidity?: string;
}

const SEED_MARKETS: SeedMarket[] = [
  {
    title: "Bitcoin will reach $100,000 by December 31st, 2024",
    description: "Will Bitcoin (BTC) reach or exceed $100,000 USD by December 31st, 2024, 23:59:59 UTC? This market resolves to YES if Bitcoin reaches $100,000 on any major exchange (Coinbase, Binance, Kraken) at any point before the expiry date.",
    expiryDays: 60,
    creatorWallet: "So11111111111111111111111111111111111111112",
    initialLiquidity: "10000"
  },
  {
    title: "Ethereum 2.0 will have >40M ETH staked by Q2 2024",
    description: "Will the Ethereum 2.0 beacon chain have more than 40 million ETH staked by June 30th, 2024? This market resolves based on official Ethereum beacon chain statistics showing total staked ETH exceeding 40,000,000.",
    expiryDays: 45,
    creatorWallet: "So11111111111111111111111111111111111111112",
    initialLiquidity: "5000"
  },
  {
    title: "Solana DeFi TVL will exceed $5 billion by end of 2024",
    description: "Will the total value locked (TVL) in Solana DeFi protocols exceed $5 billion USD by December 31st, 2024? This market resolves based on DeFiLlama or similar reputable TVL tracking service data.",
    expiryDays: 90,
    creatorWallet: "So11111111111111111111111111111111111111112",
    initialLiquidity: "7500"
  },
  {
    title: "Apple will announce Vision Pro 2 in 2024",
    description: "Will Apple officially announce a Vision Pro 2 or next-generation Vision Pro device during 2024? This market resolves to YES if Apple makes an official announcement of a successor to the Vision Pro before December 31st, 2024.",
    expiryDays: 120,
    creatorWallet: "So11111111111111111111111111111111111111112",
    initialLiquidity: "3000"
  },
  {
    title: "ChatGPT will have >200M monthly active users by mid-2024",
    description: "Will ChatGPT report having more than 200 million monthly active users by June 30th, 2024? This market resolves based on official OpenAI announcements or credible third-party reports of user numbers.",
    expiryDays: 30,
    creatorWallet: "So11111111111111111111111111111111111111112",
    initialLiquidity: "4000"
  },
  {
    title: "Tesla will deliver >2M vehicles in 2024",
    description: "Will Tesla deliver more than 2 million vehicles globally in 2024? This market resolves based on Tesla's official quarterly delivery reports, with the final Q4 2024 report determining the outcome.",
    expiryDays: 150,
    creatorWallet: "So11111111111111111111111111111111111111112",
    initialLiquidity: "8000"
  },
  {
    title: "US Fed will cut interest rates by >1% in 2024",
    description: "Will the US Federal Reserve cut the federal funds rate by more than 1 percentage point (100 basis points) during 2024? This market resolves based on official Fed rate decisions throughout the year.",
    expiryDays: 100,
    creatorWallet: "So11111111111111111111111111111111111111112",
    initialLiquidity: "6000"
  },
  {
    title: "SpaceX will complete Starship orbital mission in Q1 2024",
    description: "Will SpaceX successfully complete a full orbital mission with Starship (including successful launch, orbit, and landing/recovery) in Q1 2024 (January 1 - March 31)? This market resolves based on official SpaceX announcements and mission success criteria.",
    expiryDays: 15,
    creatorWallet: "So11111111111111111111111111111111111111112",
    initialLiquidity: "2500"
  }
];

async function createSeedUser(walletAddress: string): Promise<void> {
  try {
    const existingUser = await storage.getUserByWallet(walletAddress);
    if (!existingUser) {
      await storage.createUser({
        walletAddress,
        username: `User_${walletAddress.slice(-8)}`,
        balance: "100000" // Give seed user $100k for testing
      });
      console.log(`✅ Created seed user: ${walletAddress}`);
    } else {
      console.log(`ℹ️  Seed user already exists: ${walletAddress}`);
    }
  } catch (error) {
    console.error(`❌ Failed to create seed user: ${error}`);
  }
}

async function seedMarket(marketData: SeedMarket): Promise<void> {
  try {
    // Create expiry date
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + marketData.expiryDays);

    // Ensure creator user exists
    await createSeedUser(marketData.creatorWallet);

    // Create market
    const market = await storage.createMarket({
      title: marketData.title,
      description: marketData.description,
      creatorId: marketData.creatorWallet,
      expiryDate: expiryDate.toISOString(),
      liquidity: marketData.initialLiquidity || "0"
    });

    console.log(`✅ Created market: "${market.title}" (ID: ${market.id})`);
    console.log(`   Expires: ${expiryDate.toISOString()}`);
    console.log(`   Initial Liquidity: $${marketData.initialLiquidity || "0"}`);
    
    return;
  } catch (error) {
    console.error(`❌ Failed to create market "${marketData.title}": ${error}`);
  }
}

async function clearExistingData(): Promise<void> {
  try {
    console.log("🧹 Clearing existing seed data...");
    
    // Note: In a production environment, you might want to be more selective
    // about what data to clear. For development, we'll clear all markets.
    await db.execute("DELETE FROM trades");
    await db.execute("DELETE FROM positions");
    await db.execute("DELETE FROM orders");
    await db.execute("DELETE FROM markets");
    // Keep users as they might have wallet connections
    
    console.log("✅ Cleared existing data");
  } catch (error) {
    console.error(`❌ Failed to clear existing data: ${error}`);
  }
}

async function seedMarkets(): Promise<void> {
  console.log("🌱 Starting market seeding process...");
  console.log(`📊 Seeding ${SEED_MARKETS.length} markets`);

  try {
    // Clear existing data (optional - comment out if you want to keep existing data)
    const clearData = process.argv.includes('--clear');
    if (clearData) {
      await clearExistingData();
    }

    // Create all seed markets
    for (const marketData of SEED_MARKETS) {
      await seedMarket(marketData);
    }

    console.log("🎉 Market seeding completed successfully!");
    console.log(`✅ Created ${SEED_MARKETS.length} markets`);
    
    // Display summary
    console.log("\n📋 Summary of created markets:");
    const markets = await storage.getActiveMarkets();
    markets.forEach((market, index) => {
      console.log(`${index + 1}. ${market.title}`);
      console.log(`   Volume: $${market.volume} | Liquidity: $${market.liquidity}`);
      console.log(`   YES: $${market.yesPrice} | NO: $${market.noPrice}`);
    });

  } catch (error) {
    console.error("❌ Market seeding failed:", error);
    process.exit(1);
  }
}

// Run the seeding script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMarkets()
    .then(() => {
      console.log("🏁 Seeding script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding script failed:", error);
      process.exit(1);
    });
}

export { seedMarkets, SEED_MARKETS };
