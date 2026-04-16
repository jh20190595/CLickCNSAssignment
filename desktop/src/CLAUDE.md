# Desktop `src/` 파일 가이드

Electron 셸. Next.js 서버(`http://localhost:3000`)를 BrowserWindow에 로드하는 얇은 래퍼.

- **main.js** — Electron 메인 프로세스. `BrowserWindow` 생성 후 `http://localhost:3000` 로드. `--dev` 플래그가 있으면 DevTools 오픈. 창 닫힘/앱 종료 이벤트 처리.
- **preload.js** — 렌더러 주입용 preload. `contextBridge`로 `window.electronAPI.platform`(process.platform)만 노출. 노드 통합은 off, contextIsolation은 on.
