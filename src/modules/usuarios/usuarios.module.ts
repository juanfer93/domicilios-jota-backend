import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosService } from './usuarios.service';
import {
  DomiciliariosPublicController,
  UsersPublicController,
} from './usuarios.controller';
import { Usuario } from './entities/usuario.entity';
import { UsuariosRepository } from './repositories/usuarios.repository';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), EmailModule],
  controllers: [DomiciliariosPublicController, UsersPublicController],
  providers: [UsuariosService, UsuariosRepository],
  exports: [UsuariosService],
})
export class UsuariosModule {}
