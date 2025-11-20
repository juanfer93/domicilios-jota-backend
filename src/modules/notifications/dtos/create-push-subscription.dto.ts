import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUrl, ValidateNested, IsNumber } from 'class-validator';

class KeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

export class CreatePushSubscriptionDto {
  @IsUrl()
  endpoint: string;

  @ValidateNested()
  @Type(() => KeysDto)
  keys: KeysDto;

  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;
}
