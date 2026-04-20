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
const SRT_TARGZ_URL = 'https://files.pythonhosted.org/packages/66/b7/4a1bc231e0681ebf339337b0cd05b91dc6a0d701fa852bb812e244b7a030/srt-3.5.3.tar.gz';
const VOSK_DEPS_WHLS = [
  'https://files.pythonhosted.org/packages/16/e1/3079a9ff9b8e11b846c6ac5c8b5bfb7ff225eee721825310c91b3b50304f/tqdm-4.67.3-py3-none-any.whl',
  'https://files.pythonhosted.org/packages/f9/9b/335f9764261e915ed497fcdeb11df5dfd6f7bf257d4a6a2a686d80da4d54/requests-2.32.3-py3-none-any.whl',
  'https://files.pythonhosted.org/packages/9a/3c/c17fb3ca2d9c3acff52e30b309f538586f9f5b9c9cf454f3845fc9af4881/certifi-2026.2.25-py3-none-any.whl',
  'https://files.pythonhosted.org/packages/db/8f/61959034484a4a7c527811f4721e75d02d653a35afb0b6054474d8185d4c/charset_normalizer-3.4.7-py3-none-any.whl',
  'https://files.pythonhosted.org/packages/0e/61/66938bbb5fc52dbdf84594873d5b51fb1f7c7794e9c0f5bd885f30bc507b/idna-3.11-py3-none-any.whl',
  'https://files.pythonhosted.org/packages/39/08/aaaad47bc4e9dc8c725e68f9d04865dbcb2052843ff09c97b08904852d84/urllib3-2.6.3-py3-none-any.whl',
];
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

  // Download & install srt (source-only package — just copy srt.py)
  const srtTarFile = path.join(DESKTOP, 'tmp_srt.tar.gz');
  if (!fs.existsSync(srtTarFile)) {
    await download(SRT_TARGZ_URL, srtTarFile);
  }
  console.log('Extracting srt...');
  execSync(`tar xzf "${srtTarFile}" -C "${DESKTOP}"`, { stdio: 'inherit' });
  fs.copyFileSync(path.join(DESKTOP, 'srt-3.5.3', 'srt.py'), path.join(sitePackages, 'srt.py'));
  fs.rmSync(path.join(DESKTOP, 'srt-3.5.3'), { recursive: true });
  fs.unlinkSync(srtTarFile);

  // Download & extract vosk dependency wheels
  for (const depUrl of VOSK_DEPS_WHLS) {
    const depName = path.basename(depUrl);
    const depFile = path.join(DESKTOP, `tmp_${depName}`);
    if (!fs.existsSync(depFile)) {
      await download(depUrl, depFile);
    }
    console.log(`Extracting ${depName}...`);
    unzipFile(depFile, sitePackages);
    fs.unlinkSync(depFile);
  }

  // Cleanup temp files
  fs.unlinkSync(zipFile);
  fs.unlinkSync(whlFile);

  console.log(`Python ${PYTHON_VERSION} + vosk ${VOSK_VERSION} prepared.`);
}

async function main() {
  // Clean previous resources, but preserve pre-downloaded files
  const vcRedistPreserve = path.join(RESOURCES, 'vc_redist.x64.exe');
  const hadVcRedist = fs.existsSync(vcRedistPreserve);
  let vcRedistTmp = null;
  if (hadVcRedist) {
    vcRedistTmp = path.join(DESKTOP, 'tmp_vc_redist.x64.exe');
    fs.copyFileSync(vcRedistPreserve, vcRedistTmp);
  }
  if (fs.existsSync(RESOURCES)) {
    fs.rmSync(RESOURCES, { recursive: true });
  }
  fs.mkdirSync(RESOURCES, { recursive: true });
  if (vcRedistTmp && fs.existsSync(vcRedistTmp)) {
    fs.copyFileSync(vcRedistTmp, vcRedistPreserve);
    fs.unlinkSync(vcRedistTmp);
  }

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

  // ── 5. VC++ Redistributable ──
  const vcRedistDest = path.join(RESOURCES, 'vc_redist.x64.exe');
  if (fs.existsSync(vcRedistDest)) {
    console.log('\n=== VC++ Redistributable already present, skipping download ===');
  } else {
    console.log('\n=== Downloading VC++ Redistributable ===');
    await download(VCREDIST_URL, vcRedistDest);
    console.log('VC++ Redistributable downloaded.');
  }

  console.log('\n=== All resources prepared ===');
}

main().catch((e) => {
  console.error('Prepare failed:', e);
  process.exit(1);
});
