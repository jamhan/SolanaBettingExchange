import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function getAllFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip common directories that shouldn't be in GitHub
      if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build' || file === '.next' || file === 'coverage' || file.startsWith('.')) {
        continue;
      }
      await getAllFiles(filePath, fileList);
    } else {
      // Skip common files that shouldn't be in GitHub
      if (file.endsWith('.log') || file === '.env' || file === '.env.local' || file.startsWith('.DS_Store')) {
        continue;
      }
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

async function uploadToGitHub() {
  console.log('🚀 Starting GitHub upload process...');
  
  try {
    const octokit = await getUncachableGitHubClient();
    const owner = 'jamhan';
    const repo = 'SolanaBettingExchange';
    
    console.log('📂 Collecting project files...');
    const projectRoot = process.cwd();
    const allFiles = await getAllFiles(projectRoot);
    
    console.log(`📋 Found ${allFiles.length} files to upload`);

    // First create a README to initialize the repository
    console.log('📝 Creating README.md...');
    const readmeContent = `# SolBet Exchange - Solana Betting Platform

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

1. Install dependencies: \`npm install\`
2. Set up environment variables
3. Run database migrations: \`npx drizzle-kit push\`
4. Start the development server: \`npm run dev\`

## Development

- Use the "Test Wallet" button for development without needing Phantom
- Markets can be created through the UI or API
- WebSocket provides real-time order book updates

## Project Structure

- \`client/\` - React frontend application
- \`server/\` - Express backend with API routes
- \`shared/\` - Shared TypeScript schemas and types
- \`scripts/\` - Utility scripts for seeding and simulation
- \`anchor/\` - Solana program skeleton (future implementation)

Built with ❤️ for decentralized prediction markets.
`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: 'Initial commit: Add README.md',
      content: Buffer.from(readmeContent).toString('base64')
    });

    console.log('✅ README.md created successfully');

    // Upload key project files one by one
    const filesToUpload = allFiles.filter(filePath => {
      const relativePath = path.relative(projectRoot, filePath);
      // Include important project files, exclude the upload scripts themselves
      return !relativePath.includes('github-upload') && 
             !relativePath.includes('tmp/') &&
             !relativePath.includes('.git/');
    });

    console.log(`📤 Uploading ${filesToUpload.length} project files...`);

    for (const filePath of filesToUpload) {
      const relativePath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath);
      
      try {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: relativePath,
          message: `Add ${relativePath}`,
          content: content.toString('base64')
        });
        
        console.log(`✅ Uploaded: ${relativePath}`);
      } catch (error: any) {
        console.log(`⚠️  Skipped: ${relativePath} (${error.message})`);
      }
    }

    console.log('🎉 Successfully uploaded to GitHub!');
    console.log(`🔗 Repository URL: https://github.com/${owner}/${repo}`);
    console.log(`📊 Uploaded ${filesToUpload.length} files`);
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  }
}

// Run the upload process
uploadToGitHub()
  .then(() => {
    console.log('🏁 GitHub upload completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 GitHub upload failed:', error);
    process.exit(1);
  });