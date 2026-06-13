import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

describe('PedidosController', () => {
  const pedidosService = {
    getCurrentPedidoForDomiciliario: jest.fn(),
    getAllHistory: jest.fn(),
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
});
