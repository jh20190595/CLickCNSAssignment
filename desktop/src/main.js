const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const isDev = process.argv.includes('--dev');
const FRONTEND_URL = isDev
  ? 'http://localhost:3000'
  : 'http://localhost:3000'; // production도 Next.js 서버 사용

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 600,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#030712', // gray-950
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '음성 텍스트 변환기',
  });

  win.loadURL(FRONTEND_URL);

  if (isDev) {
    win.webContents.openDevTools();
  }

  // 메뉴바 제거
  win.setMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
