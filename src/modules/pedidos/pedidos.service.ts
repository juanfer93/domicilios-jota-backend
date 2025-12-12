import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PedidosRepository } from './repositories/pedidos.repository';
import { CreatePedidoAdminDto } from './dto/create-pedido-admin.dto';
import { FilterPedidosDto } from './dto/filter-pedidos.dto';
import { Pedido } from './entities/pedido.entity';
import { PedidoEstado } from './enums/estado-pedido.enum';
import { Between } from 'typeorm';

@Injectable()
export class PedidosService {
  constructor(
    private readonly pedidosRepository: PedidosRepository,
  ) { }


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

  async getPedidosDelDia() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return this.pedidosRepository.find({
      where: {
        createdAt: Between(start, end),
      },
      relations: ['usuario', 'comercio'],
      order: { createdAt: 'DESC' },
    });
  }

  async createPedidoByAdmin(
    dto: CreatePedidoAdminDto,
    adminId: string,
  ) {
    const pedido = this.pedidosRepository.create({
      usuarioId: dto.usuarioId,
      comercioId: dto.comercioId,
      valorFinal: dto.valorFinal,
      valorDomicilio: dto.valorDomicilio ?? 0,
      estado: PedidoEstado.EN_PROCESO,
      assignedBy: adminId,
      assignedAt: new Date(),
    });

    return this.pedidosRepository.save(pedido);
  }

  async updateEstadoPedido(
    pedidoId: string,
    estado: PedidoEstado,
  ) {
    await this.pedidosRepository.update(pedidoId, { estado });
    return this.pedidosRepository.findOne({ where: { id: pedidoId } });
  }


  async getHistorialByDate(date: string) {
    return this.pedidosRepository
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.usuario", "u")
      .leftJoinAndSelect("p.comercio", "c")
      .where(
        `
      p.created_at >= (CAST(:date AS date) AT TIME ZONE 'America/Bogota')
      AND
      p.created_at <  ((CAST(:date AS date) + INTERVAL '1 day') AT TIME ZONE 'America/Bogota')
      `,
        { date }
      )
      .orderBy("p.created_at", "DESC")
      .getMany();
  }



  async remove(id: string): Promise<void> {
    const pedido = await this.findOne(id);
    await this.pedidosRepository.remove(pedido);
  }


}