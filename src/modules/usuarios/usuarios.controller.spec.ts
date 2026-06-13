import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UsersPublicController } from './usuarios.controller';

describe('UsersPublicController', () => {
  it('mantiene publicos los endpoints de inicializacion del administrador', () => {
    const adminStatus = UsersPublicController.prototype.getAdminStatus;
    const createAdmin = UsersPublicController.prototype.createFirstAdmin;

    expect(Reflect.getMetadata(GUARDS_METADATA, adminStatus)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, createAdmin)).toBeUndefined();
  });
});
