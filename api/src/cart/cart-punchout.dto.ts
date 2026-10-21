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
  ValidateBy,
  ValidateNested,
} from 'class-validator';

// Decimal strings as sent by SDK 0.5. Keep quantities fractional and prices finite.
const DECIMAL = /^\d+(?:\.\d+)?$/;
const POSITIVE_DECIMAL = /^(?=.*[1-9])\d+(?:\.\d+)?$/;

/** Validate dictionary values without constraining language tags or identifier keys. */
function IsStringRecord(allowNull = false): PropertyDecorator {
  return ValidateBy({
    name: 'isStringRecord',
    validator: {
      validate: (value: unknown) =>
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.values(value).every(
          (entry) => typeof entry === 'string' || (allowNull && entry === null),
        ),
      defaultMessage: () =>
        `Each value in $property must be a string${allowNull ? ' or null' : ''}`,
    },
  });
}

class PunchoutQuantityDto {
  @IsIn(['per-parent-unit', 'once-per-parent', 'independent'])
  relation!: 'per-parent-unit' | 'once-per-parent' | 'independent';

  @Matches(POSITIVE_DECIMAL)
  @MaxLength(32)
  value!: string;

  @Matches(POSITIVE_DECIMAL)
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
  @IsStringRecord()
  title!: Record<string, string>;

  @IsOptional()
  @IsObject()
  @IsStringRecord()
  customerTitle?: Record<string, string>;

  @IsOptional()
  @IsObject()
  @IsStringRecord(true)
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
  @IsStringRecord(true)
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
