import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Rol } from './enums/rol.enum';
import { UsersPublicController } from './usuarios.controller';

describe('UsersPublicController', () => {
  it('protege el resumen del dashboard para administradores', () => {
    const handler = UsersPublicController.prototype.getDashboardSummar;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler);
    const roles = Reflect.getMetadata(ROLES_KEY, handler);

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(roles).toEqual([Rol.ADMIN]);
  });

  it('mantiene publicos los endpoints de inicializacion del administrador', () => {
    const adminStatus = UsersPublicController.prototype.getAdminStatus;
    const createAdmin = UsersPublicController.prototype.createFirstAdmin;

    expect(Reflect.getMetadata(GUARDS_METADATA, adminStatus)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, createAdmin)).toBeUndefined();
  });
});
