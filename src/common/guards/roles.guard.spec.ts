import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from '../../modules/usuarios/enums/rol.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const request = { user: { id: 'usuario-uuid', rol: Rol.DOMICILIARIO } };
  const handler = jest.fn();
  const controller = jest.fn();
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    request.user = { id: 'usuario-uuid', rol: Rol.DOMICILIARIO };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite al DOMICILIARIO cuando el metodo lo declara', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Rol.ADMIN,
      Rol.DOMICILIARIO,
    ]);

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [
      handler,
      controller,
    ]);
  });

  it('rechaza al DOMICILIARIO en endpoints exclusivos de ADMIN', () => {
    reflector.getAllAndOverride.mockReturnValue([Rol.ADMIN]);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rechaza solicitudes sin usuario autenticado', () => {
    reflector.getAllAndOverride.mockReturnValue([Rol.DOMICILIARIO]);
    (request as { user?: unknown }).user = undefined;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
