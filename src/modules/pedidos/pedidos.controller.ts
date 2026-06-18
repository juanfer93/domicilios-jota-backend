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
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoAdminDto } from './dto/create-pedido-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdatePedidoEstadoDto } from './dto/update-pedido-estado.dto';
import { Rol } from '../usuarios/enums/rol.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
@Controller('pedidos/admin')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get('hoy')
  @Roles(Rol.ADMIN, Rol.DOMICILIARIO)
  getPedidosDelDia(@Req() req: any) {
    return this.pedidosService.getPedidosDelDia(req.user.rol === Rol.DOMICILIARIO ? req.user.id : undefined);
  }

  @Post()
  @Roles(Rol.ADMIN)
  createPedido(@Body() dto: CreatePedidoAdminDto, @Req() req: any) {
    return this.pedidosService.createPedidoByAdmin(dto, req.user.id);
  }

  @Get('domiciliarios/disponibles')
  @Roles(Rol.DOMICILIARIO)
  getDisponiblesParaDomiciliario() {
    return this.pedidosService.getPedidosDisponiblesDomiciliario();
  }

  @Patch(':id/tomar')
  @Roles(Rol.DOMICILIARIO)
  tomarPedidoDisponible(@Param('id') id: string, @Req() req: any) {
    return this.pedidosService.tomarPedidoDisponible(id, req.user.id);
  }

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
      return this.pedidosService.getHistorialDomiciliarioUltimos60Dias(req.user.id);
    }
    return this.pedidosService.getHistorialByDate(date);
  }

  @Get('history/all')
  @Roles(Rol.ADMIN)
  getAllHistory(@Query('search') search?: string) {
    return this.pedidosService.getAllHistory(search);
  }

  @Get('domiciliarios/current')
  @Roles(Rol.DOMICILIARIO)
  getCurrentForDomiciliario(@Req() req: any) {
    return this.pedidosService.getCurrentPedidoForDomiciliario(req.user.id);
  }

  @Get('domiciliarios/history')
  @Roles(Rol.DOMICILIARIO)
  getHistorialDomiciliario(@Query('date') date: string, @Req() req: any) {
    return this.pedidosService.getHistorialDomiciliarioUltimos60Dias(req.user.id);
  }
}
