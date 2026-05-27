import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { validate } from './config/env.validation';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { ComerciosModule } from './modules/comercios/comercios.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.get<TypeOrmModuleOptions>('database')!,
      inject: [ConfigService],
    }),
    AuthModule,
    UsuariosModule,
    ComerciosModule,
    PedidosModule,
    NotificationsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}