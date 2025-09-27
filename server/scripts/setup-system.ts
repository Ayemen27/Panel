import { execSync } from 'child_process';

export async function setupSystem() {
  console.log('🔧 Setting up system for production...');

  try {
    // Check if PM2 is installed and working
    console.log('Checking PM2...');
    try {
      execSync('pm2 --version', { stdio: 'pipe' });
      console.log('✅ PM2 is available');
    } catch (error) {
      console.log('⚠️ PM2 not found, attempting to install...');
      try {
        execSync('npm install -g pm2', { stdio: 'inherit' });
        console.log('✅ PM2 installed successfully');
      } catch (installError) {
        console.error('❌ Failed to install PM2:', installError);
      }
    }

    // Check Nginx
    console.log('Checking Nginx...');
    try {
      execSync('nginx -v', { stdio: 'pipe' });
      console.log('✅ Nginx is available');
    } catch (error) {
      console.log('⚠️ Nginx not found. Please install nginx manually.');
    }

    // Setup PM2 startup
    try {
      console.log('Setting up PM2 startup...');
      execSync('pm2 startup', { stdio: 'inherit' });
      console.log('✅ PM2 startup configured');
    } catch (error) {
      console.log('⚠️ PM2 startup setup failed:', error);
    }

    // Create necessary directories
    console.log('Creating directories...');
    execSync('mkdir -p /home/administrator/logs', { stdio: 'pipe' });
    execSync('mkdir -p /home/administrator/backups', { stdio: 'pipe' });
    console.log('✅ Directories created');

    console.log('🎉 System setup completed!');

  } catch (error) {
    console.error('❌ System setup failed:', error);
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupSystem().catch(console.error);
}