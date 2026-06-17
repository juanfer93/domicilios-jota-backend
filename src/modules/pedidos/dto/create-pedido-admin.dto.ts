import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateIf } from 'class-validator';

export class CreatePedidoAdminDto {
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @IsUUID()
  @IsNotEmpty()
  comercioId!: string;

  @IsNumber()
  @IsPositive()
  valorFinal!: number;

  @IsOptional()
  @IsNumber()
  valorDomicilio?: number;

  @IsString()
  @IsNotEmpty()
  direccionDestino!: string;

  @IsOptional()
  @IsString()
  direccionRecogida?: string;

  @IsOptional()
  @IsNumber()
  valorPedido?: number;

  @IsOptional()
  @IsString()
  clienteNombre?: string;

  @IsOptional()
  @IsString()
  clienteTelefono?: string;

  @IsOptional()
  @ValidateIf((o) => o.domiciliarioId !== null)
  @IsUUID()
  domiciliarioId?: string | null;

  @IsOptional()
  @IsString()
  direccionEntrega?: string;

  @IsOptional()
  @IsString()
  detallesAdicionales?: string;
}
