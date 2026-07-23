import { IsOptional, IsString } from 'class-validator';

export class TokenRequestDto {
  @IsOptional()
  @IsString()
  oldToken?: string;
}
