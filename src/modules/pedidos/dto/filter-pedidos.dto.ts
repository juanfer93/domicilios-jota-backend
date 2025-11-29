import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoPedido } from '../enums/estado-pedido.enum';

export class FilterPedidosDto {
  @IsOptional()
  @IsEnum(EstadoPedido)
  estado?: EstadoPedido;

  @IsOptional()
  @IsUUID('4')
  comercioId?: string;

  @IsOptional()
  @IsUUID('4')
  usuarioId?: string;
}