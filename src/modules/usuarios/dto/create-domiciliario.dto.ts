import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateDomiciliarioDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEmail()
  email: string;
}