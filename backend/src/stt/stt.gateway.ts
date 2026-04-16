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

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/stt',
})
export class SttGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private segments = new Map<string, string[]>();
  private postprocessOptions = new Map<string, PostprocessOptions>();

  constructor(private readonly sttService: SttService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.segments.set(client.id, []);
    this.postprocessOptions.set(client.id, {});
    this.sttService.initRecognizer(
      client.id,
      (text) => {
        client.emit('transcript_partial', { text });
      },
      (text) => {
        this.segments.get(client.id)?.push(text);
        client.emit('transcript_final', { text });
      },
    );
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.segments.delete(client.id);
    this.postprocessOptions.delete(client.id);
    this.sttService.closeRecognizer(client.id);
  }

  @SubscribeMessage('settings_update')
  handleSettingsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() options: PostprocessOptions,
  ) {
    this.postprocessOptions.set(client.id, options ?? {});
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
    const rawJoined = buffer.join(' ').replace(/\s+/g, ' ').trim();
    const options = this.postprocessOptions.get(client.id) ?? {};
    const processed = runPostprocess(rawJoined, options);
    client.emit('transcript_complete', { raw: rawJoined, text: processed });

    this.segments.set(client.id, []);
    this.sttService.resetRecognizer(client.id);
  }
}
