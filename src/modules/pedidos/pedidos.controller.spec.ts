import { NotFoundException } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

describe('PedidosController', () => {
  const pedidosService = {
    getCurrentPedidoForDomiciliario: jest.fn(),
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

  it('conserva la respuesta 404 cuando no hay pedido en curso', async () => {
    pedidosService.getCurrentPedidoForDomiciliario.mockResolvedValue(null);

    await expect(
      controller.getCurrentForDomiciliario({ user: { id: 'usuario-id' } }),
    ).rejects.toThrow(NotFoundException);
  });
});
