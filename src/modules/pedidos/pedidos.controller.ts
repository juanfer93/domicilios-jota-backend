import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdateEstadoPedidoDto } from './dto/update-estado-pedido.dto';
import { FilterPedidosDto } from './dto/filter-pedidos.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from '../usuarios/enums/rol.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Controller('pedidos')
@UseGuards(JwtAuthGuard)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  create(
    @Body() createPedidoDto: CreatePedidoDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.pedidosService.create(createPedidoDto, usuario);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  findAll(@Query() filters: FilterPedidosDto) {
    return this.pedidosService.findAll(filters);
  }

  @Get('mis-pedidos')
  findMyPedidos(@CurrentUser('id') usuarioId: string) {
    return this.pedidosService.findMyPedidos(usuarioId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidosService.findOne(id);
  }

  @Patch(':id/estado')
  updateEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEstadoDto: UpdateEstadoPedidoDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.pedidosService.updateEstado(id, updateEstadoDto, usuario);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidosService.remove(id);
  }
}