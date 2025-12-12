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

  @Get('today')
  getPedidosDelDia() {
    return this.pedidosService.getPedidosDelDia();
  }

  @Post()
  createPedido(
    @Body() dto: CreatePedidoAdminDto,
    @Req() req,
  ) {
    return this.pedidosService.createPedidoByAdmin(
      dto,
      req.user.id,
    );
  }

  @Patch(':id/estado')
  updateEstado(
    @Param('id') id: string,
    @Body() dto: UpdatePedidoEstadoDto,
  ) {
    return this.pedidosService.updateEstadoPedido(id, dto.estado);
  }

  @Get('history')
  getHistorial(@Query('date') date: string) {
    return this.pedidosService.getHistorialByDate(date);
  }
}
