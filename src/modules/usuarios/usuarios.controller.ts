import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from './enums/rol.enum';
import { Usuario } from './entities/usuario.entity';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles(Rol.ADMIN)
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  @Get()
  @Roles(Rol.ADMIN)
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get('perfil')
  getProfile(@CurrentUser() user: Usuario) {
    return this.usuariosService.findOneWithPedidos(user.id);
  }

  @Get(':id')
  @Roles(Rol.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.findOne(id);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Delete(':id')
  @Roles(Rol.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.remove(id);
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
    // El servicio fuerza rol = ADMIN
    return this.usuariosService.createFirstAdmin(createUsuarioDto);
  }
}