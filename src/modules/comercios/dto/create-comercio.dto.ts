import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateComercioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es requerida' })
  direccion: string;
}