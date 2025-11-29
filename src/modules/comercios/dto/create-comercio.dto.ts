import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateComercioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es requerida' })
  direccion: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El valor del domicilio debe tener máximo 2 decimales' },
  )
  @IsPositive({ message: 'El valor del domicilio debe ser positivo' })
  @Transform(({ value }) => parseFloat(value))
  valorDomicilio: number;
}