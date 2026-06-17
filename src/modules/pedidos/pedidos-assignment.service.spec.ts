import { BadRequestException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { PedidosRepository } from './repositories/pedidos.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreatePedidoAdminDto } from './dto/create-pedido-admin.dto';

const baseDto: CreatePedidoAdminDto = {
  comercioId: '1beb752b-8590-4c69-9cbe-bc7714a9ee94',
  valorFinal: 25000,
  valorDomicilio: 5000,
  direccionDestino: 'Calle 1 # 2-3',
};

describe('PedidosService automatic and manual assignment', () => {
  const pedidosRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAssignmentCandidates: jest.fn(),
    findAvailableCourierById: jest.fn(),
  };

  const notificationsService = {
    notifyDomiciliarioAsignado: jest.fn(),
  };

  const usuariosService = {
    findOne: jest.fn(),
  };

  let service: PedidosService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new PedidosService(
      pedidosRepository as unknown as PedidosRepository,
      notificationsService as unknown as NotificationsService,
      usuariosService as unknown as UsuariosService,
    );

    pedidosRepository.create.mockImplementation((payload) => payload);
    pedidosRepository.save.mockImplementation(async (payload) => ({
      ...payload,
      id: 'pedido-uuid',
    }));

    usuariosService.findOne.mockResolvedValue({
      id: 'domi-old',
      nombre: 'Domi Old',
    });

    notificationsService.notifyDomiciliarioAsignado.mockResolvedValue(
      undefined,
    );
  });

  it('prioriza el domiciliario libre que lleva mas tiempo sin pedido', async () => {
    pedidosRepository.findAssignmentCandidates.mockResolvedValue([
      {
        id: 'domi-recent',
        nombre: 'Domi Recent',
        lastAssignedAt: '2026-06-16T12:00:00.000Z',
      },
      {
        id: 'domi-old',
        nombre: 'Domi Old',
        lastAssignedAt: '2026-06-10T12:00:00.000Z',
      },
    ]);

    await service.createPedidoByAdmin(baseDto, 'admin-uuid');

    expect(pedidosRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'domi-old',
        domiciliarioId: 'domi-old',
      }),
    );
  });

  it('elige aleatoriamente cuando dos domiciliarios libres empatan', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.75);

    pedidosRepository.findAssignmentCandidates.mockResolvedValue([
      {
        id: 'domi-a',
        nombre: 'Domi A',
        lastAssignedAt: null,
      },
      {
        id: 'domi-b',
        nombre: 'Domi B',
        lastAssignedAt: null,
      },
    ]);

    await service.createPedidoByAdmin(baseDto, 'admin-uuid');

    expect(pedidosRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'domi-b',
        domiciliarioId: 'domi-b',
      }),
    );

    randomSpy.mockRestore();
  });

  it('permite asignacion manual si el domiciliario esta libre', async () => {
    pedidosRepository.findAvailableCourierById.mockResolvedValue({
      id: 'domi-manual',
      nombre: 'Domi Manual',
      lastAssignedAt: null,
    });

    await service.createPedidoByAdmin(
      {
        ...baseDto,
        domiciliarioId: 'domi-manual',
      },
      'admin-uuid',
    );

    expect(pedidosRepository.findAvailableCourierById).toHaveBeenCalledWith(
      'domi-manual',
    );

    expect(pedidosRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'domi-manual',
        domiciliarioId: 'domi-manual',
      }),
    );
  });

  it('rechaza asignacion manual si el domiciliario esta ocupado o no disponible', async () => {
    pedidosRepository.findAvailableCourierById.mockResolvedValue(null);

    await expect(
      service.createPedidoByAdmin(
        {
          ...baseDto,
          domiciliarioId: 'domi-busy',
        },
        'admin-uuid',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(pedidosRepository.create).not.toHaveBeenCalled();
    expect(pedidosRepository.save).not.toHaveBeenCalled();
  });

  it('no crea pedido si todos los domiciliarios estan ocupados o no hay disponibles', async () => {
    pedidosRepository.findAssignmentCandidates.mockResolvedValue([]);

    await expect(
      service.createPedidoByAdmin(baseDto, 'admin-uuid'),
    ).rejects.toThrow(BadRequestException);

    expect(pedidosRepository.create).not.toHaveBeenCalled();
    expect(pedidosRepository.save).not.toHaveBeenCalled();
  });
});