import { Rol } from '../../usuarios/enums/rol.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  rol: Rol;
  iat?: number;
  exp?: number;
}