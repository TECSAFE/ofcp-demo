import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_SHARE_DAYS } from './whitelabel.logic';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class ShareSettingsDto {
  @IsString()
  @Matches(/\S/, { message: 'shopName must not be blank' })
  @MaxLength(120)
  shopName!: string;

  @Matches(HEX_COLOR)
  primaryColor!: string;

  @Matches(HEX_COLOR)
  surfaceColor!: string;

  @IsOptional()
  @IsBoolean()
  debugWidget?: boolean;

  @IsOptional()
  @IsBoolean()
  sdkDebugger?: boolean;
}

export class ShareLogoDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  base64!: string;
}

export class CreateWhitelabelShareDto {
  @IsString()
  @IsNotEmpty()
  secret!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_SHARE_DAYS)
  durationDays!: number;

  @ValidateNested()
  @Type(() => ShareSettingsDto)
  settings!: ShareSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShareLogoDto)
  logo?: ShareLogoDto;
}
