import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';

const MODEL_PATH = process.env.VOSK_MODEL_PATH ?? path.join(process.cwd(), 'model');
const WORKER_SCRIPT = path.join(process.cwd(), 'stt_worker.py');

interface PendingResult {
  resolve: (text: string) => void;
}

interface WorkerSession {
  process: ChildProcess;
  partialCallback: (text: string) => void;
  finalPending: PendingResult | null;
}

@Injectable()
export class SttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SttService.name);
  private sessions = new Map<string, WorkerSession>();

  onModuleInit() {
    this.logger.log(`STT Service ready. Model: ${MODEL_PATH}`);
  }

  onModuleDestroy() {
    for (const [id] of this.sessions) {
      this.closeRecognizer(id);
    }
  }

  initRecognizer(
    clientId: string,
    onPartial: (text: string) => void,
  ) {
    if (this.sessions.has(clientId)) return;

    const worker = spawn('python3', [WORKER_SCRIPT], {
      env: { ...process.env, VOSK_MODEL_PATH: MODEL_PATH },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const session: WorkerSession = {
      process: worker,
      partialCallback: onPartial,
      finalPending: null,
    };
    this.sessions.set(clientId, session);

    const rl = readline.createInterface({ input: worker.stdout! });
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'partial' && msg.text) {
          session.partialCallback(msg.text);
        } else if (msg.type === 'final') {
          session.finalPending?.resolve(msg.text ?? '');
          session.finalPending = null;
        } else if (msg.type === 'error') {
          this.logger.error(`Worker error [${clientId}]: ${msg.text}`);
        }
      } catch {
        // JSON 파싱 실패 무시
      }
    });

    worker.stderr!.on('data', (d) =>
      this.logger.debug(`[worker:${clientId}] ${d.toString().trim()}`),
    );

    worker.on('exit', (code) => {
      this.logger.warn(`Worker exited [${clientId}] code=${code}`);
      this.sessions.delete(clientId);
    });
  }

  sendChunk(clientId: string, data: Buffer): void {
    const session = this.sessions.get(clientId);
    if (!session?.process.stdin) return;

    // 프로토콜: 0x01 + 4바이트 길이 + 데이터
    const header = Buffer.alloc(5);
    header[0] = 0x01;
    header.writeUInt32BE(data.length, 1);
    session.process.stdin.write(Buffer.concat([header, data]));
  }

  finalizeResult(clientId: string): Promise<string> {
    const session = this.sessions.get(clientId);
    if (!session?.process.stdin) return Promise.resolve('');

    return new Promise((resolve) => {
      session.finalPending = { resolve };
      // 프로토콜: 0x02 (audio_end)
      const cmd = Buffer.alloc(1);
      cmd[0] = 0x02;
      session.process.stdin!.write(cmd);
      // 타임아웃 보호
      setTimeout(() => {
        if (session.finalPending) {
          session.finalPending.resolve('');
          session.finalPending = null;
        }
      }, 5000);
    });
  }

  resetRecognizer(clientId: string): void {
    const session = this.sessions.get(clientId);
    if (!session?.process.stdin) return;
    // 프로토콜: 0x03 (reset)
    const cmd = Buffer.alloc(1);
    cmd[0] = 0x03;
    session.process.stdin.write(cmd);
  }

  closeRecognizer(clientId: string): void {
    const session = this.sessions.get(clientId);
    if (!session) return;
    session.process.stdin?.end();
    session.process.kill();
    this.sessions.delete(clientId);
  }
}
