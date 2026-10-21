import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateWhitelabelShareDto } from './whitelabel.dto';
import { secretMatches, validateShareLogo } from './whitelabel.logic';
import { WhitelabelService } from './whitelabel.service';
import { ConfigService } from '../shared/config/config.service';

@Controller('whitelabel-shares')
export class WhitelabelController {
  constructor(
    private readonly whitelabel: WhitelabelService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async create(@Body() dto: CreateWhitelabelShareDto) {
    const expected = this.config.WHITELABEL_SHARE_SECRET;
    if (!expected) {
      throw new ServiceUnavailableException(
        'Whitelabel sharing is not configured',
      );
    }
    if (!secretMatches(dto.secret, expected)) {
      throw new UnauthorizedException('Wrong whitelabel share secret');
    }
    if (dto.logo) {
      const rejection = validateShareLogo(dto.logo);
      if (rejection)
        throw new BadRequestException(`Invalid logo: ${rejection}`);
    }
    const share = await this.whitelabel.createShare({
      settings: {
        shopName: dto.settings.shopName.trim(),
        primaryColor: dto.settings.primaryColor,
        surfaceColor: dto.settings.surfaceColor,
        debugWidget: dto.settings.debugWidget ?? false,
        ...(dto.settings.sdkDebugger !== undefined
          ? { sdkDebugger: dto.settings.sdkDebugger }
          : {}),
      },
      logo: dto.logo ?? null,
      durationDays: dto.durationDays,
    });
    return { id: share.id, expiresAt: share.expiresAt };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const share = await this.whitelabel.getShare(id);
    if (!share)
      throw new NotFoundException('Unknown or expired whitelabel share');
    return {
      settings: share.settings,
      logo: share.logo,
      expiresAt: share.expiresAt,
    };
  }
}
