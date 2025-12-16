import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreatePedidoAdminDto {
  @IsUUID()
  @IsNotEmpty()
  usuarioId: string;

  @IsUUID()
  @IsNotEmpty()
  comercioId: string;

  @IsNumber()
  @IsPositive()
  valorFinal: number;

  @IsOptional()
  @IsNumber()
  valorDomicilio?: number;

  @IsString()
  @IsNotEmpty()
  direccionDestino: string;
}