import { Module } from '@nestjs/common';
import { SttGateway } from './stt.gateway';
import { SttService } from './stt.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  providers: [SttGateway, SttService],
})
export class SttModule {}
