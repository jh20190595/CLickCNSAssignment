import { Module } from '@nestjs/common';
import { SttModule } from './stt/stt.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [SttModule, LlmModule],
})
export class AppModule {}
