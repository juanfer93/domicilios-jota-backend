import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PedidoEstado } from '../enums/estado-pedido.enum';

export class FilterPedidosDto {
  @IsOptional()
  @IsEnum(PedidoEstado)
  estado?: PedidoEstado;

  @IsOptional()
  @IsUUID('4')
  comercioId?: string;

  @IsOptional()
  @IsUUID('4')
  usuarioId?: string;
}