import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ConsentDto {
  @IsOptional()
  @IsIn(['v1', 'v2', 'v3'])
  version?: 'v1' | 'v2' | 'v3';

  @IsOptional()
  @IsBoolean()
  nativeTracking?: boolean;

  @IsBoolean()
  dataExchange!: boolean;

  @IsBoolean()
  tracking!: boolean;

  @IsOptional()
  @IsString()
  updatedAt?: string;
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConsentDto)
  consent?: ConsentDto;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
