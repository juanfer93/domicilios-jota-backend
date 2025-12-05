import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { Pedido } from './entities/pedido.entity';
import { PedidosRepository } from './repositories/pedidos.repository';
import { ComerciosModule } from '../comercios/comercios.module';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido]), UsuariosModule, ComerciosModule],
  controllers: [PedidosController],
  providers: [PedidosService, PedidosRepository],
  exports: [PedidosService],
})
export class PedidosModule {}