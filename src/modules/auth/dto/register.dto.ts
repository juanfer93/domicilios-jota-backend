import { OmitType } from '@nestjs/mapped-types';
import { CreateUsuarioDto } from '../../usuarios/dto/create-usuario.dto';

export class RegisterDto extends OmitType(CreateUsuarioDto, ['rol'] as const) {}