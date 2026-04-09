import { Module } from '@nestjs/common';
import { SttGateway } from './stt.gateway';
import { SttService } from './stt.service';

@Module({
  providers: [SttGateway, SttService],
})
export class SttModule {}
