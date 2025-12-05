import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosService } from './usuarios.service';
import { UsuariosController, UsersPublicController } from './usuarios.controller';
import { Usuario } from './entities/usuario.entity';
import { UsuariosRepository } from './repositories/usuarios.repository';
import { Pedido } from '../pedidos/entities/pedido.entity'
import { EmailModule } from 'src/common/email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Pedido]), EmailModule],
  controllers: [UsuariosController, UsersPublicController],
  providers: [UsuariosService, UsuariosRepository],
  exports: [UsuariosService],
})
export class UsuariosModule {}