import { Module } from '@nestjs/common';
import { SttModule } from './stt/stt.module';

@Module({
  imports: [SttModule],
})
export class AppModule {}
