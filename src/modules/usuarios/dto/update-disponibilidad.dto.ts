import { IsEnum } from 'class-validator';
import { DisponibilidadDomiciliario } from '../enums/disponibilidad-domiciliario.enum';

export class UpdateDisponibilidadDto {
  @IsEnum(DisponibilidadDomiciliario)
  disponibilidad: DisponibilidadDomiciliario;
}
