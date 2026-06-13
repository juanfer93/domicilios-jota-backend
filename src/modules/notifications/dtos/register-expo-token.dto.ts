import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class RegisterExpoTokenDto {
  /** Token Expo Push: comienza con ExponentPushToken[...] */
  @IsString()
  @IsNotEmpty()
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/)
  token: string;

  /** La aplicacion movil soportada es exclusivamente Android. */
  @IsString()
  @IsIn(['android'])
  platform: 'android';

  /** Siempre 'EXPO' desde el frontend */
  @IsString()
  @IsIn(['EXPO'])
  provider: string;
}
