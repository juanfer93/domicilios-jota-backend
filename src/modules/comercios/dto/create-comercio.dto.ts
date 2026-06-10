import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateComercioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres' })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'La direccion es requerida' })
  direccion!: string;

  @IsString()
  @IsNotEmpty({ message: 'El telefono es requerido' })
  @MaxLength(20, { message: 'El telefono no puede exceder 20 caracteres' })
  telefono!: string;
}