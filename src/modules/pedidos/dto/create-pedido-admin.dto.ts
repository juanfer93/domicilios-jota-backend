import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

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
}