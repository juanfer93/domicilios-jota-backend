import { IsEnum } from 'class-validator';
import { PedidoEstado } from '../enums/estado-pedido.enum';

export class UpdatePedidoEstadoDto {
  @IsEnum(PedidoEstado)
  estado: PedidoEstado;
}