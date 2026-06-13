import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterExpoTokenDto {
  /** Token Expo Push: comienza con ExponentPushToken[...] */
  @IsString()
  @IsNotEmpty()
  token: string;

  /** Plataforma del dispositivo: 'ios' | 'android' | 'web' */
  @IsString()
  @IsNotEmpty()
  platform: string;

  /** Siempre 'EXPO' desde el frontend */
  @IsString()
  @IsIn(['EXPO'])
  provider: string;
}
