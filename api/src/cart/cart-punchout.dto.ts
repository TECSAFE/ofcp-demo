import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// Decimal strings as sent by SDK 0.5. Keep quantities fractional and prices finite.
const DECIMAL = /^\d+(?:\.\d+)?$/;

class PunchoutQuantityDto {
  @IsIn(['per-parent-unit', 'once-per-parent', 'independent'])
  relation!: 'per-parent-unit' | 'once-per-parent' | 'independent';

  @Matches(DECIMAL)
  @MaxLength(32)
  value!: string;

  @Matches(DECIMAL)
  @MaxLength(32)
  total!: string;

  @IsString()
  @IsNotEmpty()
  unitOfMeasure!: string;
}

class PunchoutPricingDto {
  @Matches(DECIMAL)
  @MaxLength(32)
  unitPrice!: string;

  @Matches(DECIMAL)
  @MaxLength(32)
  effectiveUnitPrice!: string;

  @Matches(DECIMAL)
  @MaxLength(32)
  lineAmount!: string;

  @IsArray()
  @IsObject({ each: true })
  allowancesAndCharges!: Record<string, unknown>[];
}

class PunchoutDescriptionDto {
  @IsObject()
  @IsNotEmptyObject()
  title!: Record<string, string>;

  @IsOptional()
  @IsObject()
  customerTitle?: Record<string, string>;

  @IsOptional()
  @IsObject()
  description?: Record<string, string | null>;
}

export class CartPunchoutPositionDto {
  @IsString()
  @IsNotEmpty()
  positionId!: string;

  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  parentPositionId!: string | null;

  @IsIn(['layout', 'tecsafeService', 'hostShopArticle'])
  type!: 'layout' | 'tecsafeService' | 'hostShopArticle';

  @IsObject()
  identifiers!: Record<string, string | null>;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PunchoutDescriptionDto)
  description!: PunchoutDescriptionDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PunchoutQuantityDto)
  quantity!: PunchoutQuantityDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PunchoutPricingDto)
  pricing!: PunchoutPricingDto;

  @IsString()
  @IsNotEmpty()
  taxCategory!: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class CartPunchoutDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CartPunchoutPositionDto)
  positions!: CartPunchoutPositionDto[];

  @IsNumber()
  @Min(0)
  tecsafeTotal!: number;
}
