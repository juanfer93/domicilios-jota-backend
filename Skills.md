### 2. Backend: `domicilios-jota-backend/skills.md`

```markdown
# Skills & Patrones de Código - Backend NestJS (Jota Delivery)

Este documento contiene los patrones exactos que debes usar al generar código para este proyecto.

## Skill 1: Data Transfer Objects (DTOs)
Usa `class-validator` rigurosamente. Todos los mensajes de error deben estar en **español**. Las credenciales usan **email y contraseña** (no documentos de identificación).

```typescript
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFeatureDto {
  @IsEmail({}, { message: 'El email debe ser válido' })
  @MaxLength(150, { message: 'El email no puede exceder 150 caracteres' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'El campo es requerido' })
  descripcion: string;
}
Skill 2: Repositorios (TypeORM)
Usa el decorador @Injectable() e inyecta el DataSource. Extiende de la clase base Repository.

TypeScript
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Entidad } from '../entities/entidad.entity';

@Injectable()
export class FeatureRepository extends Repository<Entidad> {
  constructor(private dataSource: DataSource) {
    super(Entidad, dataSource.createEntityManager());
  }

  async findByCustomField(campo: string): Promise<Entidad | null> {
    return this.findOne({ where: { campo } });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.count({ where: { email } });
    return count > 0;
  }
}
Skill 3: Controladores Protegidos (JWT y Roles)
Usa Guards para JWT y Roles. Aplica los decoradores @UseGuards, @Roles y extrae el usuario actual con @CurrentUser.

TypeScript
import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { FeatureService } from './feature.service';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from '../enums/rol.enum';
import { Usuario } from '../entities/usuario.entity';

@Controller('features')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Post()
  @Roles(Rol.ADMIN)
  create(@Body() dto: CreateFeatureDto) {
    return this.featureService.create(dto);
  }

  @Get('mis-datos')
  getMisDatos(@CurrentUser() user: Usuario) {
    return this.featureService.findUserFeatures(user.id);
  }

  @Get(':id')
  @Roles(Rol.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.featureService.findOne(id);
  }
}