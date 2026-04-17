const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const { autoUpdater } = require('electron-updater');

const isDev = process.argv.includes('--dev');
const children = [];

function resourcePath(...segments) {
  if (isDev) {
    return path.join(__dirname, '..', '..', ...segments);
  }
  return path.join(process.resourcesPath, ...segments);
}

function waitForServer(port, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://localhost:${port}`, () => resolve());
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Port ${port} timeout`));
        } else {
          setTimeout(check, 300);
        }
      });
      req.end();
    };
    check();
  });
}

function spawnNode(args, cwd, extraEnv = {}) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    ...extraEnv,
  };

  const proc = spawn(process.execPath, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const label = path.basename(cwd);
  proc.stdout.on('data', (d) => console.log(`[${label}] ${d.toString().trim()}`));
  proc.stderr.on('data', (d) => console.error(`[${label}] ${d.toString().trim()}`));
  proc.on('error', (e) => console.error(`[${label}] error:`, e.message));
  children.push(proc);
  return proc;
}

function startBackend() {
  if (isDev) return;
  const backendDir = resourcePath('backend');
  const pythonDir = resourcePath('python');
  const modelDir = resourcePath('model');
  const workerPath = path.join(backendDir, 'stt_worker.py');

  const extraEnv = {
    VOSK_MODEL_PATH: modelDir,
    STT_WORKER_PATH: workerPath,
  };

  if (process.platform === 'win32') {
    const pythonExe = path.join(pythonDir, 'python.exe');
    extraEnv.BUNDLED_PYTHON = pythonExe;
  }

  spawnNode([path.join(backendDir, 'dist', 'main.js')], backendDir, extraEnv);
}

function startFrontend() {
  if (isDev) return;
  const frontendDir = resourcePath('frontend');
  spawnNode(
    [path.join(frontendDir, 'server.js')],
    frontendDir,
    { PORT: '3002', HOSTNAME: '0.0.0.0' },
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 600,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#030712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '음성 텍스트 변환기',
  });

  win.loadURL('http://localhost:3002');
  if (isDev) win.webContents.openDevTools();
  win.setMenu(null);
}

function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: '업데이트 발견',
      message: `새 버전 ${info.version}을 다운로드 중입니다. 완료 후 알려드립니다.`,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '업데이트 준비 완료',
      message: '업데이트가 다운로드되었습니다. 앱을 재시작하면 자동으로 설치됩니다.',
      buttons: ['지금 재시작', '나중에'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('Auto-update: checking for update...');
  });

  autoUpdater.on('update-not-available', () => {
    console.log('Auto-update: no update available');
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
    if (err.message && /404|HttpError/.test(err.message)) return;
    dialog.showMessageBox({
      type: 'error',
      title: '업데이트 오류',
      message: `업데이트 확인 중 오류: ${err.message}`,
    });
  });

  autoUpdater.checkForUpdates();
}

app.whenReady().then(async () => {
  if (isDev) {
    createWindow();
  } else {
    startBackend();
    startFrontend();
    try {
      await Promise.all([waitForServer(3001), waitForServer(3002)]);
    } catch (e) {
      console.error('Server start failed:', e.message);
    }
    createWindow();
    setupAutoUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function cleanup() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

app.on('before-quit', cleanup);
app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});
