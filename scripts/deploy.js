#!/usr/bin/env node

/**
 * Deployment script for Firebase hosting
 * Ensures fresh build and clears caches
 */

import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Starting deployment process...\n');

// Step 1: Clean dist folder
console.log('📦 Step 1: Cleaning dist folder...');
const distPath = join(rootDir, 'dist');
if (existsSync(distPath)) {
  rmSync(distPath, { recursive: true, force: true });
  console.log('✅ Dist folder cleaned\n');
} else {
  console.log('✅ No dist folder to clean\n');
}

// Step 2: Build the project
console.log('🔨 Step 2: Building project...');
try {
  execSync('npm run build', { 
    cwd: rootDir, 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  console.log('✅ Build completed successfully\n');
} catch (error) {
  console.error('❌ Build failed!');
  process.exit(1);
}

// Step 3: Verify dist folder exists
console.log('🔍 Step 3: Verifying build output...');
if (!existsSync(distPath)) {
  console.error('❌ Dist folder not found after build!');
  process.exit(1);
}
console.log('✅ Build output verified\n');

// Step 4: Deploy to Firebase
console.log('🚀 Step 4: Deploying to Firebase...');
try {
  execSync('firebase deploy --only hosting', { 
    cwd: rootDir, 
    stdio: 'inherit' 
  });
  console.log('\n✅ Deployment completed successfully!');
  console.log('\n🌐 Your site should be live at: https://quantum-control.web.app');
  console.log('💡 If you don\'t see changes, try:');
  console.log('   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)');
  console.log('   - Clear browser cache');
  console.log('   - Open in incognito/private window');
} catch (error) {
  console.error('❌ Deployment failed!');
  process.exit(1);
}
