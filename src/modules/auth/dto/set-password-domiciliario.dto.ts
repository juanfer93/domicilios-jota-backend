import { IsString, MinLength } from 'class-validator';

export class SetPasswordDomiciliarioDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
