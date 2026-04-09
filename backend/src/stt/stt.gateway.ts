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

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/stt',
})
export class SttGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly sttService: SttService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.sttService.initRecognizer(client.id, (text) => {
      client.emit('transcript_partial', { text });
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.sttService.closeRecognizer(client.id);
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
    const text = await this.sttService.finalizeResult(client.id);
    client.emit('transcript_final', { text });
    this.sttService.resetRecognizer(client.id);
  }
}
