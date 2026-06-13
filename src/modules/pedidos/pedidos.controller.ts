import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoAdminDto } from './dto/create-pedido-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdatePedidoEstadoDto } from './dto/update-pedido-estado.dto';
import { Rol } from '../usuarios/enums/rol.enum';
import { getColombiaDateKey } from '../../common/time/colombia-time';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
@Controller('pedidos/admin')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get('hoy')
  @Roles(Rol.ADMIN, Rol.DOMICILIARIO)
  getPedidosDelDia(@Req() req: any) {
    if (req.user.rol === Rol.DOMICILIARIO) {
      const today = getColombiaDateKey();
      return this.pedidosService.getHistorialDomiciliarioByDate(today, req.user.id);
    }
    return this.pedidosService.getPedidosDelDia();
  }

  @Post()
  createPedido(@Body() dto: CreatePedidoAdminDto, @Req() req: any) {
    return this.pedidosService.createPedidoByAdmin(dto, req.user.id);
  }

  /**
   * Cambiar estado de un pedido.
   * Se pasa el actor (rol + id) al servicio para:
   * - Validar propiedad si es DOMICILIARIO
   * - Enviar la notificación al admin correcta
   */
  @Patch(':id/estado')
  @Roles(Rol.ADMIN, Rol.DOMICILIARIO)
  updateEstado(
    @Param('id') id: string,
    @Body() dto: UpdatePedidoEstadoDto,
    @Req() req: any,
  ) {
    return this.pedidosService.updateEstadoPedido(id, dto.estado, {
      id: req.user.id,
      rol: req.user.rol as Rol,
    });
  }

  @Get('history')
  @Roles(Rol.ADMIN, Rol.DOMICILIARIO)
  getHistorial(@Query('date') date: string, @Req() req: any) {
    if (req.user.rol === Rol.DOMICILIARIO) {
      return this.pedidosService.getHistorialDomiciliarioByDate(date, req.user.id);
    }
    return this.pedidosService.getHistorialByDate(date);
  }

  @Get('domiciliarios/current')
  @Roles(Rol.DOMICILIARIO)
  async getCurrentForDomiciliario(@Req() req: any) {
    const userId = req.user.id;

    const pedido =
      await this.pedidosService.getCurrentPedidoForDomiciliario(userId);

    if (!pedido) {
      throw new NotFoundException(
        'No hay servicio en curso para este domiciliario.',
      );
    }

    return pedido;
  }

  @Get('domiciliarios/history')
  @Roles(Rol.DOMICILIARIO)
  getHistorialDomiciliario(@Query('date') date: string, @Req() req: any) {
    return this.pedidosService.getHistorialDomiciliarioByDate(date, req.user.id);
  }
}
