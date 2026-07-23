import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  articleNumber!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  configurationId?: string;
}
