import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PedidosRepository } from './repositories/pedidos.repository';
import { ComerciosService } from '../comercios/comercios.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdateEstadoPedidoDto } from './dto/update-estado-pedido.dto';
import { FilterPedidosDto } from './dto/filter-pedidos.dto';
import { Pedido } from './entities/pedido.entity';
import { EstadoPedido } from './enums/estado-pedido.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rol } from '../usuarios/enums/rol.enum';

@Injectable()
export class PedidosService {
  constructor(
    private readonly pedidosRepository: PedidosRepository,
    private readonly comerciosService: ComerciosService,
  ) { }

  async create(
    createPedidoDto: CreatePedidoDto,
    usuario: Usuario,
  ): Promise<Pedido> {
    const comercio = await this.comerciosService.findOne(
      createPedidoDto.comercioId,
    );

    const pedido = this.pedidosRepository.create({
      ...createPedidoDto,
      usuarioId: usuario.id,
      valorDomicilio: comercio.valorDomicilio,
      estado: EstadoPedido.PENDIENTE,
    });

    const savedPedido = await this.pedidosRepository.save(pedido);

    const pedidoWithRelations = await this.pedidosRepository.findByIdWithRelations(savedPedido.id);

    if (!pedidoWithRelations) {
      throw new NotFoundException('Error al crear el pedido');
    }

    return pedidoWithRelations;
  }

  async findAll(filters: FilterPedidosDto): Promise<Pedido[]> {
    return this.pedidosRepository.findWithFilters(filters);
  }

  async findOne(id: string): Promise<Pedido> {
    const pedido = await this.pedidosRepository.findByIdWithRelations(id);

    if (!pedido) {
      throw new NotFoundException(`Pedido con ID ${id} no encontrado`);
    }

    return pedido;
  }

  async findMyPedidos(usuarioId: string): Promise<Pedido[]> {
    return this.pedidosRepository.findByUsuario(usuarioId);
  }

  async updateEstado(
    id: string,
    updateEstadoDto: UpdateEstadoPedidoDto,
    usuario: Usuario,
  ): Promise<Pedido> {
    const pedido = await this.findOne(id);

    if (usuario.rol !== Rol.ADMIN) {
      if (pedido.usuarioId !== usuario.id) {
        throw new ForbiddenException(
          'No puedes modificar pedidos de otros usuarios',
        );
      }

      if (updateEstadoDto.estado !== EstadoPedido.CANCELADO) {
        throw new ForbiddenException('Solo puedes cancelar tus pedidos');
      }

      if (pedido.estado !== EstadoPedido.PENDIENTE) {
        throw new ForbiddenException('Solo puedes cancelar pedidos pendientes');
      }
    }

    pedido.estado = updateEstadoDto.estado;

    return this.pedidosRepository.save(pedido);
  }

  async remove(id: string): Promise<void> {
    const pedido = await this.findOne(id);
    await this.pedidosRepository.remove(pedido);
  }
}