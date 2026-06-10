import { NotificationsService } from '../notifications/notifications.service';
import { CreatePedidoAdminDto } from './dto/create-pedido-admin.dto';
import { PedidoEstado } from './enums/estado-pedido.enum';
import { PedidosRepository } from './repositories/pedidos.repository';
import { PedidosService } from './pedidos.service';

describe('PedidosService', () => {
  const pedidosRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const notificationsService = {
    notifyUser: jest.fn(),
  };
  let service: PedidosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PedidosService(
      pedidosRepository as unknown as PedidosRepository,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('crea el pedido y notifica al domiciliario asignado', async () => {
    const dto: CreatePedidoAdminDto = {
      usuarioId: '5d6517de-c78a-4b99-bdb4-d981c13c27c5',
      comercioId: '1beb752b-8590-4c69-9cbe-bc7714a9ee94',
      valorFinal: 25000,
      valorDomicilio: 5000,
      direccionDestino: 'Calle 1 # 2-3',
    };
    const pedidoCreado = { ...dto, estado: PedidoEstado.EN_PROCESO };
    const pedidoGuardado = { ...pedidoCreado, id: 'pedido-id' };
    pedidosRepository.create.mockReturnValue(pedidoCreado);
    pedidosRepository.save.mockResolvedValue(pedidoGuardado);
    notificationsService.notifyUser.mockResolvedValue({ ok: true, sent: 1 });

    await expect(service.createPedidoByAdmin(dto, 'admin-id')).resolves.toBe(
      pedidoGuardado,
    );
    expect(notificationsService.notifyUser).toHaveBeenCalledWith(
      dto.usuarioId,
      expect.objectContaining({ pedidoId: 'pedido-id' }),
    );
  });

  it('no falla la creacion del pedido si la notificacion falla', async () => {
    const dto: CreatePedidoAdminDto = {
      usuarioId: '5d6517de-c78a-4b99-bdb4-d981c13c27c5',
      comercioId: '1beb752b-8590-4c69-9cbe-bc7714a9ee94',
      valorFinal: 25000,
      direccionDestino: 'Calle 1 # 2-3',
    };
    const pedidoGuardado = { id: 'pedido-id' };
    pedidosRepository.create.mockReturnValue({});
    pedidosRepository.save.mockResolvedValue(pedidoGuardado);
    notificationsService.notifyUser.mockRejectedValue(new Error('push caido'));

    await expect(service.createPedidoByAdmin(dto, 'admin-id')).resolves.toBe(
      pedidoGuardado,
    );
  });
});
