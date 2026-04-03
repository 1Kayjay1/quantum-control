const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing Ghostline Desktop Build...\n');

const platform = process.platform;
const desktopDir = path.join(__dirname, '..');
const pythonRuntimeDir = path.join(desktopDir, 'python-runtime');
const backendDir = path.join(desktopDir, '..', 'ghostline-backend');

// Step 1: Check if python-runtime exists
console.log('📦 Step 1: Checking Python runtime...');
if (!fs.existsSync(pythonRuntimeDir)) {
  console.log('❌ Python runtime not found!');
  console.log('\n📝 To create embedded Python runtime:\n');
  
  if (platform === 'win32') {
    console.log('Windows:');
    console.log('1. Download Python Embeddable Package from:');
    console.log('   https://www.python.org/downloads/windows/');
    console.log('   (Look for "Windows embeddable package (64-bit)")');
    console.log('2. Extract to: ghostline-desktop/python-runtime/');
    console.log('3. Download get-pip.py from: https://bootstrap.pypa.io/get-pip.py');
    console.log('4. Run: python-runtime\\python.exe get-pip.py');
    console.log('5. Run: python-runtime\\python.exe -m pip install -r ../ghostline-backend/requirements.txt');
  } else if (platform === 'darwin') {
    console.log('macOS:');
    console.log('1. Install Python standalone build:');
    console.log('   brew install python@3.11');
    console.log('2. Create virtual environment:');
    console.log('   python3 -m venv python-runtime');
    console.log('3. Install dependencies:');
    console.log('   python-runtime/bin/pip install -r ../ghostline-backend/requirements.txt');
  } else {
    console.log('Linux:');
    console.log('1. Create virtual environment:');
    console.log('   python3 -m venv python-runtime');
    console.log('2. Install dependencies:');
    console.log('   python-runtime/bin/pip install -r ../ghostline-backend/requirements.txt');
  }
  
  console.log('\n⚠️  Cannot proceed without Python runtime.');
  process.exit(1);
}

console.log('✅ Python runtime found\n');

// Step 2: Verify backend files
console.log('📦 Step 2: Checking backend files...');
const requiredFiles = [
  'websocket_server.py',
  'codrone_wrapper.py',
  'requirements.txt'
];

for (const file of requiredFiles) {
  const filePath = path.join(backendDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Missing backend file: ${file}`);
    process.exit(1);
  }
}

console.log('✅ Backend files verified\n');

// Step 3: Check dependencies installed
console.log('📦 Step 3: Verifying Python dependencies...');
try {
  const pythonExe = platform === 'win32' 
    ? path.join(pythonRuntimeDir, 'python.exe')
    : path.join(pythonRuntimeDir, 'bin', 'python3');
  
  const result = execSync(`"${pythonExe}" -m pip list`, { encoding: 'utf-8' });
  
  const requiredPackages = ['websockets', 'codrone-edu'];
  const missingPackages = [];
  
  for (const pkg of requiredPackages) {
    if (!result.toLowerCase().includes(pkg.toLowerCase())) {
      missingPackages.push(pkg);
    }
  }
  
  if (missingPackages.length > 0) {
    console.log(`❌ Missing Python packages: ${missingPackages.join(', ')}`);
    console.log('\n📝 Install with:');
    console.log(`"${pythonExe}" -m pip install ${missingPackages.join(' ')}`);
    process.exit(1);
  }
  
  console.log('✅ Python dependencies verified\n');
} catch (error) {
  console.log('⚠️  Could not verify Python dependencies');
  console.log('   Make sure pip is installed in python-runtime\n');
}

// Step 4: Create assets folder if needed
console.log('📦 Step 4: Checking assets...');
const assetsDir = path.join(desktopDir, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log('⚠️  Assets folder created, but icons are missing!');
  console.log('   Add icon.png, icon.ico, and icon.icns to assets/');
} else {
  console.log('✅ Assets folder exists\n');
}

// Step 5: Install npm dependencies
console.log('📦 Step 5: Installing npm dependencies...');
try {
  execSync('npm install', { cwd: desktopDir, stdio: 'inherit' });
  console.log('✅ npm dependencies installed\n');
} catch (error) {
  console.log('❌ Failed to install npm dependencies');
  process.exit(1);
}

// Done!
console.log('✅ Build preparation complete!\n');
console.log('📦 Ready to build:');
console.log('   npm run build:win    # Windows portable');
console.log('   npm run build:mac    # macOS DMG');
console.log('   npm run build:linux  # Linux AppImage');
console.log('');
