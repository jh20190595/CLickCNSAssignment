import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import {
  LlmService,
  SoapMeta,
  SoapResult,
  Utterance,
} from './llm.service';

interface SoapRequestBody {
  transcript: string;
  meta?: SoapMeta;
  segments?: Utterance[];
}

@Controller('llm')
export class LlmController {
  private readonly logger = new Logger(LlmController.name);

  constructor(private readonly llm: LlmService) {}

  @Post('soap')
  async classify(@Body() body: SoapRequestBody): Promise<SoapResult> {
    if (typeof body?.transcript !== 'string') {
      throw new HttpException('transcript is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.llm.classifySoap(body.transcript, {
        meta: body.meta ?? {},
        segments: body.segments,
      });
    } catch (e) {
      this.logger.error(e instanceof Error ? e.message : String(e));
      throw new HttpException(
        'SOAP 분류 중 오류가 발생했습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
