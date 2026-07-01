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
  ganancia: 9000,
  direccionDestino: 'Calle 1 # 2-3',
};

describe('PedidosService queue and manual assignment', () => {
  const pedidosRepository = {
    create: jest.fn(),
    save: jest.fn(),
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
      id: 'domi-manual',
      nombre: 'Domi Manual',
    });

    notificationsService.notifyDomiciliarioAsignado.mockResolvedValue(undefined);
    jest.spyOn(service as any, 'notifyPedidoDisponible').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'notifyAssignedDomiciliario').mockResolvedValue(undefined);
  });

  it('crea pedido libre sin asignacion cuando el admin no escoge domiciliario', async () => {
    await service.createPedidoByAdmin(baseDto, 'admin-uuid');

    expect(pedidosRepository.findAvailableCourierById).not.toHaveBeenCalled();
    expect(pedidosRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: null,
        domiciliarioId: null,
        valorDomicilio: 9000,
        ganancia: 9000,
        assignedBy: 'admin-uuid',
        assignedAt: null,
      }),
    );
    expect((service as any).notifyPedidoDisponible).toHaveBeenCalledWith('pedido-uuid');
  });

  it('permite asignacion manual si el domiciliario esta libre', async () => {
    pedidosRepository.findAvailableCourierById.mockResolvedValue({
      id: 'domi-manual',
      nombre: 'Domi Manual',
      lastAssignedAt: null,
      activePedidosCount: 2,
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
        valorDomicilio: 9000,
        ganancia: 9000,
        assignedBy: 'admin-uuid',
      }),
    );
    expect((service as any).notifyAssignedDomiciliario).toHaveBeenCalledWith(
      'domi-manual',
      'pedido-uuid',
    );
  });

  it('rechaza asignacion manual si el domiciliario llego al cupo o no disponible', async () => {
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

  it('mantiene compatibilidad si un cliente anterior envia solo valorDomicilio', async () => {
    const dtoAnterior = {
      ...baseDto,
      ganancia: undefined,
      valorDomicilio: 5000,
    };

    await service.createPedidoByAdmin(dtoAnterior, 'admin-uuid');

    expect(pedidosRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        valorDomicilio: 5000,
        ganancia: 5000,
      }),
    );
  });
});
