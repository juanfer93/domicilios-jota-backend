import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Rol } from '../enums/rol.enum';

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @IsEmail({}, { message: 'El email debe ser válido' })
  @MaxLength(150, { message: 'El email no puede exceder 150 caracteres' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @IsEnum(Rol, { message: 'El rol debe ser admin o cliente' })
  rol: Rol;
}