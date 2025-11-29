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
import { ComerciosService } from './comercios.service';
import { CreateComercioDto } from './dto/create-comercio.dto';
import { UpdateComercioDto } from './dto/update-comercio.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../usuarios/enums/rol.enum';

@Controller('comercios')
@UseGuards(JwtAuthGuard)
export class ComerciosController {
  constructor(private readonly comerciosService: ComerciosService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  create(@Body() createComercioDto: CreateComercioDto) {
    return this.comerciosService.create(createComercioDto);
  }

  @Get()
  findAll() {
    return this.comerciosService.findAll();
  }

  @Get('search')
  search(@Query('nombre') nombre: string) {
    return this.comerciosService.search(nombre || '');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.comerciosService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateComercioDto: UpdateComercioDto,
  ) {
    return this.comerciosService.update(id, updateComercioDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.comerciosService.remove(id);
  }
}