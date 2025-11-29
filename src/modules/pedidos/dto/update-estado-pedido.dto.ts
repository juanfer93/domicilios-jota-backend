import { IsEnum } from 'class-validator';
import { EstadoPedido } from '../enums/estado-pedido.enum';

export class UpdateEstadoPedidoDto {
  @IsEnum(EstadoPedido, {
    message: 'El estado debe ser: pendiente, en_proceso, entregado o cancelado',
  })
  estado: EstadoPedido;
}