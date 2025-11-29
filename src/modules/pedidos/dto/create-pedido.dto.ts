import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePedidoDto {
  @IsUUID('4', { message: 'El ID del comercio debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El comercio es requerido' })
  comercioId: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El valor final debe tener máximo 2 decimales' },
  )
  @IsPositive({ message: 'El valor final debe ser positivo' })
  @Transform(({ value }) => parseFloat(value))
  valorFinal: number;
}