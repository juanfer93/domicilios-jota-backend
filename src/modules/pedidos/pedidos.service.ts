import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PedidosRepository } from './repositories/pedidos.repository';
import { ComerciosService } from '../comercios/comercios.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreatePedidoAdminDto } from './dto/create-pedido-admin.dto';
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
    private readonly usuariosService: UsuariosService,
    private readonly comerciosService: ComerciosService,
  ) { }

  async createByAdmin(dto: CreatePedidoAdminDto): Promise<Pedido> {
    const usuario = await this.usuariosService.findOne(dto.usuarioId);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const comercio = await this.comerciosService.findOne(dto.comercioId);
    if (!comercio) {
      throw new NotFoundException('Comercio no encontrado');
    }

    const pedido = this.pedidosRepository.create({
      usuario,
      comercio,
      valorFinal: dto.valorFinal,
      estado: EstadoPedido.PENDIENTE,
    });

    return this.pedidosRepository.save(pedido);
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