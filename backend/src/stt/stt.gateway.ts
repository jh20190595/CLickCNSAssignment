import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SttService } from './stt.service';
import { runPostprocess } from '../postprocess/pipeline';
import type { PostprocessOptions } from '../postprocess/pipeline';
import { labelSegments } from '../postprocess/speakerLabel';
import { LlmService, Utterance } from '../llm/llm.service';

type SessionOptions = PostprocessOptions & {
  speakerLabel?: boolean;
};

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/stt',
})
export class SttGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private segments = new Map<string, string[]>();
  private sessionOptions = new Map<string, SessionOptions>();

  constructor(
    private readonly sttService: SttService,
    private readonly llm: LlmService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.segments.set(client.id, []);
    this.sessionOptions.set(client.id, {});
    try {
      this.sttService.initRecognizer(
        client.id,
        (text) => {
          client.emit('transcript_partial', { text });
        },
        (text) => {
          this.segments.get(client.id)?.push(text);
          client.emit('transcript_final', { text });
        },
        (message) => {
          client.emit('stt_error', { message });
        },
      );
    } catch (e) {
      console.error(`STT init failed for ${client.id}: ${e instanceof Error ? e.message : String(e)}`);
      client.emit('stt_error', { message: 'Speech recognition unavailable' });
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.segments.delete(client.id);
    this.sessionOptions.delete(client.id);
    this.sttService.closeRecognizer(client.id);
  }

  @SubscribeMessage('settings_update')
  handleSettingsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() options: SessionOptions,
  ) {
    this.sessionOptions.set(client.id, options ?? {});
  }

  @SubscribeMessage('audio_chunk')
  handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Buffer,
  ) {
    this.sttService.sendChunk(client.id, Buffer.from(data));
  }

  @SubscribeMessage('audio_end')
  async handleAudioEnd(@ConnectedSocket() client: Socket) {
    const tail = await this.sttService.finalizeResult(client.id);
    const buffer = this.segments.get(client.id) ?? [];
    if (tail) {
      buffer.push(tail);
      client.emit('transcript_final', { text: tail });
    }

    const options = this.sessionOptions.get(client.id) ?? {};
    const postprocessOptions: PostprocessOptions = {
      dateFormat: options.dateFormat,
    };

    const rawJoined = buffer.join(' ').replace(/\s+/g, ' ').trim();
    const processedSegments = buffer
      .map((s) => runPostprocess(s, postprocessOptions))
      .filter((s) => s.trim().length > 0);
    const processedText = processedSegments.join(' ').replace(/\s+/g, ' ').trim();

    let labeled: Utterance[] = [];
    try {
      labeled = await labelSegments(processedSegments, this.llm, {
        enabled: !!options.speakerLabel,
      });
    } catch (e) {
      console.error(
        `화자 라벨링 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
      labeled = processedSegments.map<Utterance>((text) => ({
        speaker: 'doctor',
        text,
      }));
    }

    client.emit('transcript_complete', {
      raw: rawJoined,
      text: processedText,
      segments: labeled,
    });

    this.segments.set(client.id, []);
    this.sttService.resetRecognizer(client.id);
  }
}
