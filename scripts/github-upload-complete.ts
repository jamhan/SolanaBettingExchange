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
      // Skip directories that shouldn't be in GitHub
      if (file === 'node_modules' || file === '.git' || file === 'dist' || 
          file === 'build' || file === '.next' || file === 'coverage' || 
          file.startsWith('.') || file === 'tmp') {
        continue;
      }
      await getAllFiles(filePath, fileList);
    } else {
      // Skip files that shouldn't be in GitHub
      if (file.endsWith('.log') || file === '.env' || file === '.env.local' || 
          file.startsWith('.DS_Store') || file.includes('github-upload') ||
          file.endsWith('.lock')) {
        continue;
      }
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

async function getExistingFileSha(octokit: any, owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path
    });
    
    if ('sha' in data) {
      return data.sha;
    }
  } catch (error: any) {
    if (error.status === 404) {
      return null; // File doesn't exist
    }
    throw error;
  }
  return null;
}

async function uploadToGitHub() {
  console.log('🚀 Starting complete GitHub upload process...');
  
  try {
    const octokit = await getUncachableGitHubClient();
    const owner = 'jamhan';
    const repo = 'SolanaBettingExchange';
    
    console.log('📂 Collecting all project files...');
    const projectRoot = process.cwd();
    const allFiles = await getAllFiles(projectRoot);
    
    console.log(`📋 Found ${allFiles.length} files to upload`);

    // Group files by priority (important files first)
    const priorityFiles = [
      'package.json',
      'tsconfig.json', 
      'tailwind.config.ts',
      'vite.config.ts',
      'drizzle.config.ts',
      '.gitignore'
    ];

    const coreFiles = allFiles.filter(filePath => {
      const relativePath = path.relative(projectRoot, filePath);
      return priorityFiles.includes(relativePath) ||
             relativePath.startsWith('shared/') ||
             relativePath.startsWith('server/') ||
             relativePath.startsWith('client/') ||
             relativePath.startsWith('anchor/');
    });

    const scriptFiles = allFiles.filter(filePath => {
      const relativePath = path.relative(projectRoot, filePath);
      return relativePath.startsWith('scripts/') && !relativePath.includes('github-upload');
    });

    const filesToUpload = [...coreFiles, ...scriptFiles];

    console.log(`📤 Uploading ${filesToUpload.length} project files...`);

    let uploadedCount = 0;
    let skippedCount = 0;

    for (const filePath of filesToUpload) {
      const relativePath = path.relative(projectRoot, filePath);
      
      try {
        const content = fs.readFileSync(filePath);
        const existingSha = await getExistingFileSha(octokit, owner, repo, relativePath);
        
        const uploadData: any = {
          owner,
          repo,
          path: relativePath,
          message: existingSha ? `Update ${relativePath}` : `Add ${relativePath}`,
          content: content.toString('base64')
        };

        // Include SHA for updates
        if (existingSha) {
          uploadData.sha = existingSha;
        }

        await octokit.rest.repos.createOrUpdateFileContents(uploadData);
        
        console.log(`✅ ${existingSha ? 'Updated' : 'Added'}: ${relativePath}`);
        uploadedCount++;
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.log(`⚠️  Skipped: ${relativePath} (${error.message})`);
        skippedCount++;
      }
    }

    console.log('🎉 Successfully uploaded to GitHub!');
    console.log(`🔗 Repository URL: https://github.com/${owner}/${repo}`);
    console.log(`📊 Results: ${uploadedCount} uploaded, ${skippedCount} skipped`);
    console.log('\n🎯 Your Solana market is now documented in the repository!');
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  }
}

// Run the upload process
uploadToGitHub()
  .then(() => {
    console.log('🏁 Complete GitHub upload finished successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 GitHub upload failed:', error);
    process.exit(1);
  });