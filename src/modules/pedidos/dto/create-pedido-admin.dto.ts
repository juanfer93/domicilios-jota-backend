import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

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
}