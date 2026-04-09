const { contextBridge } = require('electron');

// 필요한 경우 Electron API를 렌더러에 안전하게 노출
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
