import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { Rol } from '../usuarios/enums/rol.enum';

describe('PedidosController', () => {
  const pedidosService = {
    getCurrentPedidoForDomiciliario: jest.fn(),
    getAllHistory: jest.fn(),
    getHistorialByDate: jest.fn(),
    getHistorialDomiciliarioByDate: jest.fn(),
    getHistorialDomiciliarioUltimos60Dias: jest.fn(),
  };
  let controller: PedidosController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PedidosController(
      pedidosService as unknown as PedidosService,
    );
  });

  it('consulta el pedido actual con el id del usuario autenticado', async () => {
    const pedido = { id: 'pedido-id' };
    pedidosService.getCurrentPedidoForDomiciliario.mockResolvedValue(pedido);

    await expect(
      controller.getCurrentForDomiciliario({ user: { id: 'usuario-id' } }),
    ).resolves.toBe(pedido);
    expect(pedidosService.getCurrentPedidoForDomiciliario).toHaveBeenCalledWith(
      'usuario-id',
    );
  });

  it('retorna null sin error cuando no hay pedido en curso', async () => {
    pedidosService.getCurrentPedidoForDomiciliario.mockResolvedValue(null);

    await expect(
      controller.getCurrentForDomiciliario({ user: { id: 'usuario-id' } }),
    ).resolves.toBeNull();
  });

  it('delega la busqueda del historial global', async () => {
    pedidosService.getAllHistory.mockResolvedValue([{ id: 'pedido-id' }]);

    await expect(controller.getAllHistory('comercio')).resolves.toEqual([
      { id: 'pedido-id' },
    ]);
    expect(pedidosService.getAllHistory).toHaveBeenCalledWith('comercio');
  });

  it('consulta el historial del domiciliario con el UUID autenticado', async () => {
    pedidosService.getHistorialDomiciliarioUltimos60Dias.mockResolvedValue([
      { id: 'pedido-propio' },
    ]);

    await expect(
      controller.getHistorial('2026-06-13', {
        user: { id: 'domiciliario-uuid', rol: Rol.DOMICILIARIO },
      }),
    ).resolves.toEqual([{ id: 'pedido-propio' }]);
    expect(
      pedidosService.getHistorialDomiciliarioUltimos60Dias,
    ).toHaveBeenCalledWith('domiciliario-uuid');
    expect(pedidosService.getHistorialByDate).not.toHaveBeenCalled();
  });

  it('mantiene el historial global reservado al admin', async () => {
    pedidosService.getHistorialByDate.mockResolvedValue([{ id: 'pedido' }]);

    await controller.getHistorial('2026-06-13', {
      user: { id: 'admin-uuid', rol: Rol.ADMIN },
    });

    expect(pedidosService.getHistorialByDate).toHaveBeenCalledWith(
      '2026-06-13',
    );
    expect(
      pedidosService.getHistorialDomiciliarioByDate,
    ).not.toHaveBeenCalled();
  });

  it('declara la creacion de pedidos exclusivamente para ADMIN', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      PedidosController.prototype.createPedido,
    );

    expect(roles).toEqual([Rol.ADMIN]);
  });
});
