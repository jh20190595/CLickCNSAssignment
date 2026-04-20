/**
 * Builds backend + frontend, downloads Windows embeddable Python + vosk,
 * copies Vosk model, and places everything into desktop/resources/
 * for electron-builder to bundle as extraResources.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { createUnzip } = require('zlib');

const ROOT = path.resolve(__dirname, '..', '..');
const DESKTOP = path.join(ROOT, 'desktop');
const RESOURCES = path.join(DESKTOP, 'resources');

const PYTHON_VERSION = '3.11.9';
const PYTHON_ZIP_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
const VOSK_VERSION = '0.3.45';
const VOSK_WHL_URL = `https://files.pythonhosted.org/packages/py3/v/vosk/vosk-${VOSK_VERSION}-py3-none-win_amd64.whl`;
const VCREDIST_URL = 'https://aka.ms/vs/17/release/vc_redist.x64.exe';

function run(cmd, cwd) {
  console.log(`\n> [${path.basename(cwd)}] ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    const follow = (u) => {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    follow(url);
  });
}

function unzipFile(zipPath, destDir) {
  execSync(`unzip -o -q "${zipPath}" -d "${destDir}"`);
}

async function preparePython() {
  const pythonDir = path.join(RESOURCES, 'python');
  fs.mkdirSync(pythonDir, { recursive: true });

  const zipFile = path.join(DESKTOP, 'tmp_python.zip');
  const whlFile = path.join(DESKTOP, 'tmp_vosk.whl');

  // Download Python embeddable
  if (!fs.existsSync(zipFile)) {
    await download(PYTHON_ZIP_URL, zipFile);
  }
  console.log('Extracting Python embeddable...');
  unzipFile(zipFile, pythonDir);

  // Enable import in embeddable Python - uncomment "import site" in ._pth
  const pthFiles = fs.readdirSync(pythonDir).filter(f => f.endsWith('._pth'));
  for (const pth of pthFiles) {
    const pthPath = path.join(pythonDir, pth);
    let content = fs.readFileSync(pthPath, 'utf8');
    content = content.replace(/^#\s*import site/m, 'import site');
    // Add Lib directory for vosk
    if (!content.includes('Lib')) {
      content += '\nLib\nLib\\site-packages\n';
    }
    fs.writeFileSync(pthPath, content);
  }

  // Download vosk wheel
  if (!fs.existsSync(whlFile)) {
    await download(VOSK_WHL_URL, whlFile);
  }

  // Extract vosk wheel (it's a zip) into python's Lib/site-packages
  const sitePackages = path.join(pythonDir, 'Lib', 'site-packages');
  fs.mkdirSync(sitePackages, { recursive: true });
  console.log('Extracting vosk wheel...');
  unzipFile(whlFile, sitePackages);

  // Cleanup temp files
  fs.unlinkSync(zipFile);
  fs.unlinkSync(whlFile);

  console.log(`Python ${PYTHON_VERSION} + vosk ${VOSK_VERSION} prepared.`);
}

async function main() {
  // Clean previous resources
  if (fs.existsSync(RESOURCES)) {
    fs.rmSync(RESOURCES, { recursive: true });
  }
  fs.mkdirSync(RESOURCES, { recursive: true });

  // ── 1. Build backend ──
  console.log('\n=== Building backend ===');
  const backendDir = path.join(ROOT, 'backend');
  run('npm run build', backendDir);

  const backendRes = path.join(RESOURCES, 'backend');
  fs.mkdirSync(backendRes, { recursive: true });

  copyDir(path.join(backendDir, 'dist'), path.join(backendRes, 'dist'));

  console.log('Installing backend production deps...');
  fs.copyFileSync(path.join(backendDir, 'package.json'), path.join(backendRes, 'package.json'));
  fs.copyFileSync(path.join(backendDir, 'package-lock.json'), path.join(backendRes, 'package-lock.json'));
  run('npm ci --omit=dev', backendRes);

  // Copy stt_worker.py
  const workerSrc = path.join(backendDir, 'src', 'stt', 'stt_worker.py');
  if (!fs.existsSync(workerSrc)) {
    throw new Error(`STT worker not found at ${workerSrc}`);
  }
  fs.copyFileSync(workerSrc, path.join(backendRes, 'stt_worker.py'));

  // ── 2. Build frontend ──
  console.log('\n=== Building frontend ===');
  const frontendDir = path.join(ROOT, 'frontend');
  run('npm run build', frontendDir);

  const frontendRes = path.join(RESOURCES, 'frontend');
  const standaloneSrc = path.join(frontendDir, '.next', 'standalone');
  copyDir(standaloneSrc, frontendRes);

  const staticSrc = path.join(frontendDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    copyDir(staticSrc, path.join(frontendRes, '.next', 'static'));
  }

  const publicSrc = path.join(frontendDir, 'public');
  if (fs.existsSync(publicSrc)) {
    copyDir(publicSrc, path.join(frontendRes, 'public'));
  }

  // ── 3. Download & bundle Python + vosk for Windows ──
  console.log('\n=== Preparing Python + vosk ===');
  await preparePython();

  // ── 4. Copy Vosk model ──
  console.log('\n=== Copying Vosk model ===');
  const modelSrc = path.join(ROOT, 'backend', 'model');
  if (fs.existsSync(modelSrc)) {
    copyDir(modelSrc, path.join(RESOURCES, 'model'));
    console.log('Vosk model copied.');
  } else {
    console.warn('WARNING: Vosk model not found at backend/model/. STT will be disabled.');
  }

  // ── 5. Download VC++ Redistributable ──
  console.log('\n=== Downloading VC++ Redistributable ===');
  const vcRedistDest = path.join(RESOURCES, 'vc_redist.x64.exe');
  await download(VCREDIST_URL, vcRedistDest);
  console.log('VC++ Redistributable downloaded.');

  console.log('\n=== All resources prepared ===');
}

main().catch((e) => {
  console.error('Prepare failed:', e);
  process.exit(1);
});
