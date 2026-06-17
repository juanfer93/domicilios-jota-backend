import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from './enums/rol.enum';
import { Usuario } from './entities/usuario.entity';
import { CreateDomiciliarioDto } from './dto/create-domiciliario.dto';
import { ToggleBloqueoDto } from './dto/toggle-bloqueo.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DomiciliariosPublicController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('perfil')
  getProfile(@CurrentUser() user: Usuario) {
    return this.usuariosService.findOneWithPedidos(user.id);
  }

  @Patch('perfil/password')
  @Roles(Rol.ADMIN, Rol.DOMICILIARIO)
  changeCurrentUserPassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usuariosService.changeCurrentUserPassword(userId, dto);
  }

  @Post('domiciliarios')
  @Roles(Rol.ADMIN)
  async createDomiciliario(@Body() dto: CreateDomiciliarioDto) {
    return this.usuariosService.createDomiciliario(dto);
  }

  @Get('domiciliarios')
  @Roles(Rol.ADMIN, Rol.DOMICILIARIO)
  findAllDomiciliarios() {
    return this.usuariosService.findAllDomiciliarios();
  }

  @Get('domiciliarios/search')
  @Roles(Rol.ADMIN)
  searchDomiciliarios(@Query('nombre') nombre: string) {
    return this.usuariosService.searchDomiciliarios(nombre || '');
  }

  @Patch('domiciliarios/:id/bloqueo')
  @Roles(Rol.ADMIN)
  toggleBloqueo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ToggleBloqueoDto,
  ) {
    return this.usuariosService.toggleBloqueo(id, dto.bloqueado);
  }
}

@Controller('users')
export class UsersPublicController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('admin-status')
  getAdminStatus() {
    return this.usuariosService.getAdminStatus();
  }

  @Post('admin')
  createFirstAdmin(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.createFirstAdmin(createUsuarioDto);
  }
}