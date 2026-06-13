import { IsBoolean } from 'class-validator';

export class ToggleBloqueoDto {
  @IsBoolean()
  bloqueado: boolean;
}
