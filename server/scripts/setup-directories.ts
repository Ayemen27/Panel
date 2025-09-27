
#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../../shared/environment';

const REQUIRED_DIRECTORIES = [
  'storage',
  'real-files', 
  'uploads',
  'logs',
  'config',
  'ssl',
  'nginx'
];

async function setupDirectories() {
  console.log('🏗️ Setting up required directories...');
  
  const baseDir = ENV_CONFIG.isReplit ? '/home/runner' : '/home/administrator/Panel';
  
  for (const dir of REQUIRED_DIRECTORIES) {
    const dirPath = path.join(baseDir, dir);
    
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
        console.log(`✅ Created directory: ${dirPath}`);
      } else {
        console.log(`✓ Directory already exists: ${dirPath}`);
      }
      
      // Ensure correct permissions
      fs.chmodSync(dirPath, 0o755);
      
    } catch (error) {
      console.error(`❌ Failed to create directory ${dirPath}:`, error);
    }
  }
  
  console.log('🎉 Directory setup completed!');
}

// Run if called directly
if (require.main === module) {
  setupDirectories().catch(console.error);
}

export { setupDirectories };
