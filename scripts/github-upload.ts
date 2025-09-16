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
      if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') {
        continue;
      }
      await getAllFiles(filePath, fileList);
    } else {
      // Skip common files that shouldn't be in GitHub
      if (file.endsWith('.log') || file === '.env' || file === '.env.local') {
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
    
    // Check if repository exists, create if it doesn't
    let repository;
    try {
      const { data } = await octokit.rest.repos.get({ owner, repo });
      repository = data;
      console.log('✅ Repository exists:', repository.html_url);
    } catch (error: any) {
      if (error.status === 404) {
        console.log('📝 Creating new repository...');
        const { data } = await octokit.rest.repos.createForAuthenticatedUser({
          name: repo,
          description: 'SolBet Exchange - A decentralized prediction market platform built on Solana',
          private: false,
          auto_init: false
        });
        repository = data;
        console.log('✅ Repository created:', repository.html_url);
      } else {
        throw error;
      }
    }

    // Get all files in the project
    console.log('📂 Collecting project files...');
    const projectRoot = process.cwd();
    const allFiles = await getAllFiles(projectRoot);
    
    console.log(`📋 Found ${allFiles.length} files to upload`);

    // Check if repository is empty
    let isEmpty = false;
    try {
      await octokit.rest.repos.getContent({
        owner,
        repo,
        path: ''
      });
    } catch (error: any) {
      if (error.status === 404) {
        isEmpty = true;
        console.log('📋 Repository is empty, will create initial commit');
      }
    }

    // Create a new tree with all files
    const tree = [];
    for (const filePath of allFiles) {
      const relativePath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      tree.push({
        path: relativePath,
        mode: '100644' as const,
        type: 'blob' as const,
        content: content
      });
      
      console.log(`📄 Added: ${relativePath}`);
    }

    // Create tree
    console.log('🌳 Creating project tree...');
    const { data: treeData } = await octokit.rest.git.createTree({
      owner,
      repo,
      tree
    });

    // Create commit
    console.log('💾 Creating commit...');
    const commitData: any = {
      owner,
      repo,
      message: 'Initial commit: SolBet Exchange - Solana Betting Platform\n\n- Full-stack prediction market platform\n- React frontend with wallet integration\n- Node.js/TypeScript backend with matching engine\n- PostgreSQL database with Drizzle ORM\n- Real-time WebSocket updates\n- Test wallet functionality for development',
      tree: treeData.sha
    };

    // For empty repos, don't include parents
    if (!isEmpty) {
      try {
        const { data: ref } = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: 'heads/main'
        });
        commitData.parents = [ref.object.sha];
      } catch (error) {
        // Main branch doesn't exist, proceed without parents
      }
    }

    const { data: commit } = await octokit.rest.git.createCommit(commitData);

    // Update main branch reference
    console.log('🔄 Updating main branch...');
    try {
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: 'heads/main',
        sha: commit.sha
      });
    } catch (error: any) {
      if (error.status === 422) {
        // Main branch doesn't exist, create it
        await octokit.rest.git.createRef({
          owner,
          repo,
          ref: 'refs/heads/main',
          sha: commit.sha
        });
        console.log('✅ Created main branch');
      } else {
        throw error;
      }
    }

    console.log('🎉 Successfully uploaded to GitHub!');
    console.log(`🔗 Repository URL: ${repository.html_url}`);
    console.log(`📊 Uploaded ${allFiles.length} files`);
    console.log(`💾 Commit SHA: ${commit.sha}`);
    
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