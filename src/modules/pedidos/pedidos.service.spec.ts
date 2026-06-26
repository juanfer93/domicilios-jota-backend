import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePedidoAdminDto } from './dto/create-pedido-admin.dto';
import { PedidoEstado } from './enums/estado-pedido.enum';
import { PedidosRepository } from './repositories/pedidos.repository';
import { PedidosService } from './pedidos.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { Rol } from '../usuarios/enums/rol.enum';

const makePedido = (overrides = {}) => ({
  id: 'pedido-uuid',
  domiciliarioId: 'domi-uuid',
  assignedBy: 'admin-uuid',
  estado: PedidoEstado.EN_PROCESO,
  ...overrides,
});

const makeUsuario = (overrides = {}) => ({
  id: 'domi-uuid',
  nombre: 'Juan Domiciliario',
  rol: Rol.DOMICILIARIO,
  ...overrides,
});

describe('PedidosService', () => {
  let service: PedidosService;

  const pedidosRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    findAllHistory: jest.fn(),
    findAssignmentCandidates: jest.fn(),
    findAvailableCourierById: jest.fn(),
  };

  const notificationsService = {
    notifyUser: jest.fn(),
    notifyDomiciliarioAsignado: jest.fn(),
    notifyAdminEstadoCambiado: jest.fn(),
  };

  const usuariosService = {
    findOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    pedidosRepository.findAvailableCourierById.mockImplementation(
      async (domiciliarioId: string) => ({
        id: domiciliarioId,
        nombre: 'Domiciliario Disponible',
        lastAssignedAt: null,
      }),
    );

    pedidosRepository.findAssignmentCandidates.mockResolvedValue([
      {
        id: 'domi-uuid',
        nombre: 'Juan Domiciliario',
        lastAssignedAt: null,
      },
    ]);

    service = new PedidosService(
      pedidosRepository as unknown as PedidosRepository,
      notificationsService as unknown as NotificationsService,
      usuariosService as unknown as UsuariosService,
    );
  });

  // ── createPedidoByAdmin ──────────────────────────────────────────────────

  describe('createPedidoByAdmin', () => {
    const baseDto: CreatePedidoAdminDto = {
      usuarioId: '5d6517de-c78a-4b99-bdb4-d981c13c27c5',
      comercioId: '1beb752b-8590-4c69-9cbe-bc7714a9ee94',
      valorFinal: 25000,
      valorDomicilio: 5000,
      ganancia: 9000,
      direccionDestino: 'Calle 1 # 2-3',
    };

    it('crea el pedido correctamente y retorna el pedido guardado', async () => {
      const pedidoGuardado = { ...baseDto, id: 'pedido-id', estado: PedidoEstado.EN_PROCESO };
      pedidosRepository.create.mockReturnValue(pedidoGuardado);
      pedidosRepository.save.mockResolvedValue(pedidoGuardado);
      usuariosService.findOne.mockResolvedValue(makeUsuario({ id: baseDto.usuarioId }));
      notificationsService.notifyDomiciliarioAsignado.mockResolvedValue(undefined);

      const result = await service.createPedidoByAdmin(baseDto, 'admin-id');
      expect(result).toBe(pedidoGuardado);
      expect(pedidosRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          valorDomicilio: 9000,
          ganancia: 9000,
        }),
      );
    });

    it('notifica al domiciliario cuando se asigna un domiciliarioId', async () => {
      const dto = { ...baseDto, domiciliarioId: 'domi-uuid' };
      const pedidoGuardado = { ...dto, id: 'pedido-id' };
      pedidosRepository.create.mockReturnValue(pedidoGuardado);
      pedidosRepository.save.mockResolvedValue(pedidoGuardado);
      usuariosService.findOne.mockResolvedValue(makeUsuario());
      notificationsService.notifyDomiciliarioAsignado.mockResolvedValue(undefined);

      await service.createPedidoByAdmin(dto, 'admin-id');

      // Damos tiempo a la promesa void
      await new Promise((r) => setImmediate(r));

      expect(notificationsService.notifyDomiciliarioAsignado).toHaveBeenCalledWith(
        expect.objectContaining({ pedidoId: 'pedido-id' }),
      );
    });

    it('no falla la creación si la notificación lanza error', async () => {
      const dto = { ...baseDto, domiciliarioId: 'domi-uuid' };
      const pedidoGuardado = { ...dto, id: 'pedido-id' };
      pedidosRepository.create.mockReturnValue(pedidoGuardado);
      pedidosRepository.save.mockResolvedValue(pedidoGuardado);
      usuariosService.findOne.mockResolvedValue(makeUsuario());
      notificationsService.notifyDomiciliarioAsignado.mockRejectedValue(new Error('push caido'));

      await expect(service.createPedidoByAdmin(dto, 'admin-id')).resolves.toBe(pedidoGuardado);
    });

    it('usa usuarioId como domiciliarioId para clientes anteriores', async () => {
      const pedidoGuardado = { ...baseDto, id: 'pedido-id' };
      pedidosRepository.create.mockReturnValue(pedidoGuardado);
      pedidosRepository.save.mockResolvedValue(pedidoGuardado);
      usuariosService.findOne.mockResolvedValue(makeUsuario({ id: baseDto.usuarioId }));
      notificationsService.notifyDomiciliarioAsignado.mockResolvedValue(undefined);

      await service.createPedidoByAdmin(baseDto, 'admin-id');
      await new Promise((r) => setImmediate(r));

      expect(pedidosRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ domiciliarioId: baseDto.usuarioId }),
      );
      expect(notificationsService.notifyDomiciliarioAsignado).toHaveBeenCalledWith(
        expect.objectContaining({ domiciliarioId: baseDto.usuarioId }),
      );
    });

    it('rechaza asignacion manual si el domiciliario no esta disponible', async () => {
      const dto = {
        ...baseDto,
        domiciliarioId: 'domi-ocupado',
      };

      pedidosRepository.findAvailableCourierById.mockResolvedValueOnce(null);

      await expect(
        service.createPedidoByAdmin(dto, 'admin-id'),
      ).rejects.toThrow(BadRequestException);

      expect(pedidosRepository.create).not.toHaveBeenCalled();
      expect(pedidosRepository.save).not.toHaveBeenCalled();
    });
  });

  // ── updateEstadoPedido ───────────────────────────────────────────────────

  describe('updateEstadoPedido', () => {
    it('admin puede cambiar el estado de cualquier pedido', async () => {
      const pedido = makePedido();
      pedidosRepository.findOne
        .mockResolvedValueOnce(pedido) // primera llamada: buscar el pedido
        .mockResolvedValueOnce({ ...pedido, estado: PedidoEstado.HECHO }); // segunda: retornar actualizado
      pedidosRepository.update.mockResolvedValue(undefined);

      const result = await service.updateEstadoPedido(
        'pedido-uuid',
        PedidoEstado.HECHO,
        { id: 'admin-uuid', rol: Rol.ADMIN },
      );

      expect(pedidosRepository.update).toHaveBeenCalledWith(
        'pedido-uuid',
        { estado: PedidoEstado.HECHO },
      );
      expect(result?.estado).toBe(PedidoEstado.HECHO);
    });

    it('domiciliario puede cambiar estado de su propio pedido', async () => {
      const pedido = makePedido({
        domiciliarioId: 'domi-uuid',
        valorDomicilio: 9000,
        ganancia: 9000,
      });
      pedidosRepository.findOne
        .mockResolvedValueOnce(pedido)
        .mockResolvedValueOnce({ ...pedido, estado: PedidoEstado.HECHO });
      pedidosRepository.update.mockResolvedValue(undefined);
      usuariosService.findOne.mockResolvedValue(makeUsuario());
      notificationsService.notifyAdminEstadoCambiado.mockResolvedValue(undefined);

      const result = await service.updateEstadoPedido(
        'pedido-uuid',
        PedidoEstado.HECHO,
        { id: 'domi-uuid', rol: Rol.DOMICILIARIO },
      );

      expect(pedidosRepository.update).toHaveBeenCalledWith(
        'pedido-uuid',
        { estado: PedidoEstado.HECHO },
      );
      // Esperar la notificación void
      await new Promise((r) => setImmediate(r));
      expect(notificationsService.notifyAdminEstadoCambiado).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-uuid',
          estado: PedidoEstado.HECHO,
          ganancia: 9000,
        }),
      );
    });

    it('domiciliario NO puede cambiar el estado de un pedido ajeno → ForbiddenException', async () => {
      const pedido = makePedido({ domiciliarioId: 'otro-domi-uuid' });
      pedidosRepository.findOne.mockResolvedValueOnce(pedido);

      await expect(
        service.updateEstadoPedido(
          'pedido-uuid',
          PedidoEstado.HECHO,
          { id: 'domi-uuid', rol: Rol.DOMICILIARIO },
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(pedidosRepository.update).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el pedido no existe', async () => {
      pedidosRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateEstadoPedido('no-existe', PedidoEstado.HECHO, {
          id: 'admin-uuid',
          rol: Rol.ADMIN,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('no permite reabrir un pedido finalizado', async () => {
      pedidosRepository.findOne.mockResolvedValueOnce(
        makePedido({ estado: PedidoEstado.HECHO }),
      );

      await expect(
        service.updateEstadoPedido('pedido-uuid', PedidoEstado.EN_PROCESO, {
          id: 'admin-uuid',
          rol: Rol.ADMIN,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(pedidosRepository.update).not.toHaveBeenCalled();
    });

    it('NO modifica createdAt al terminar un pedido (bug corregido)', async () => {
      const pedido = makePedido();
      pedidosRepository.findOne
        .mockResolvedValueOnce(pedido)
        .mockResolvedValueOnce({ ...pedido, estado: PedidoEstado.HECHO });
      pedidosRepository.update.mockResolvedValue(undefined);

      await service.updateEstadoPedido('pedido-uuid', PedidoEstado.HECHO, {
        id: 'admin-uuid',
        rol: Rol.ADMIN,
      });

      // Verificar que update NUNCA se llama con createdAt
      expect(pedidosRepository.update).toHaveBeenCalledWith(
        'pedido-uuid',
        expect.not.objectContaining({ createdAt: expect.anything() }),
      );
    });
  });

  describe('getAllHistory', () => {
    it('busca por nombre de comercio o domiciliario', async () => {
      const pedidos = [makePedido()];
      pedidosRepository.findAllHistory.mockResolvedValue(pedidos);

      await expect(service.getAllHistory('  Juan  ')).resolves.toEqual(pedidos);
      expect(pedidosRepository.findAllHistory).toHaveBeenCalledWith(
        'Juan',
        expect.any(Date),
      );
    });

    it('consulta todo el historial cuando no hay busqueda', async () => {
      pedidosRepository.findAllHistory.mockResolvedValue([]);

      await service.getAllHistory('   ');

      expect(pedidosRepository.findAllHistory).toHaveBeenCalledWith(
        undefined,
        expect.any(Date),
      );
    });
  });

  describe('getHistorialDomiciliarioByDate', () => {
    it('filtra por el usuarioId UUID autenticado', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'pedido-propio' }]),
      };
      pedidosRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(
        service.getHistorialDomiciliarioByDate(
          '2026-06-13',
          '5d6517de-c78a-4b99-bdb4-d981c13c27c5',
        ),
      ).resolves.toEqual([{ id: 'pedido-propio' }]);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('p.usuario_id = :usuarioId'),
        expect.objectContaining({
          usuarioId: '5d6517de-c78a-4b99-bdb4-d981c13c27c5',
        }),
      );
    });
  });

  describe('retencion de pedidos', () => {
    it('mantiene activos y finalizados de las ultimas 12 horas en Pedidos', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      pedidosRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.getPedidosDelDia('domiciliario-uuid');

      expect(queryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('p.updated_at >= :finalCutoff'),
        expect.objectContaining({
          activeState: PedidoEstado.EN_PROCESO,
          finalStates: [PedidoEstado.HECHO, PedidoEstado.CANCELADO],
          finalCutoff: expect.any(Date),
        }),
      );
      const visibilityParams = queryBuilder.where.mock.calls[0][1] as {
        finalCutoff: Date;
      };
      expect(
        Math.abs(
          visibilityParams.finalCutoff.getTime() -
          (Date.now() - 12 * 60 * 60 * 1000),
        ),
      ).toBeLessThan(1000);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'p.usuario_id = :usuarioId',
        { usuarioId: 'domiciliario-uuid' },
      );
    });

    it('limita el historial del domiciliario a 60 dias', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      pedidosRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.getHistorialDomiciliarioUltimos60Dias('domiciliario-uuid');

      expect(queryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('p.created_at >= :retentionCutoff'),
        expect.objectContaining({
          retentionCutoff: expect.any(Date),
          usuarioId: 'domiciliario-uuid',
        }),
      );
      const historyParams = queryBuilder.where.mock.calls[0][1] as {
        retentionCutoff: Date;
      };
      expect(
        Math.abs(
          historyParams.retentionCutoff.getTime() -
          (Date.now() - 60 * 24 * 60 * 60 * 1000),
        ),
      ).toBeLessThan(1000);
    });
  });
});
