import { DataSource } from 'typeorm';
import { Pedido } from '../entities/pedido.entity';
import { PedidoEstado } from '../enums/estado-pedido.enum';
import { PedidosRepository } from './pedidos.repository';

const makeQueryBuilder = () => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  having: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
  getRawOne: jest.fn().mockResolvedValue(null),
});

describe('PedidosRepository assignment candidates', () => {
  it('incluye domiciliarios con menos de 3 pedidos activos EN_PROCESO', async () => {
    const queryBuilder = makeQueryBuilder();

    const dataSource = {
      createEntityManager: jest.fn().mockReturnValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as DataSource;

    const repository = new PedidosRepository(dataSource);

    await repository.findAssignmentCandidates();

    expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
      Pedido,
      'activePedido',
      'activePedido.usuario_id = usuario.id AND activePedido.estado = :activeState',
      { activeState: PedidoEstado.EN_PROCESO },
    );

    expect(queryBuilder.having).toHaveBeenCalledWith(
      'COUNT(DISTINCT activePedido.id) < :maxActivePedidos',
      { maxActivePedidos: 3 },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'usuario.disponibilidad = :disponibilidad',
      { disponibilidad: 'available' },
    );
  });

  it('filtra un domiciliario manual por id y solo si esta disponible', async () => {
    const queryBuilder = makeQueryBuilder();

    const dataSource = {
      createEntityManager: jest.fn().mockReturnValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as DataSource;

    const repository = new PedidosRepository(dataSource);

    await repository.findAvailableCourierById('domi-uuid');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'usuario.id = :domiciliarioId',
      { domiciliarioId: 'domi-uuid' },
    );

    expect(queryBuilder.getRawOne).toHaveBeenCalled();
  });
});
