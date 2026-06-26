import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { Rol } from '../usuarios/enums/rol.enum';
import { UsuariosService } from '../usuarios/usuarios.service';

describe('AuthService', () => {
  const usuariosService = {
    findByEmail: jest.fn(),
    validatePassword: jest.fn(),
    updateDomiciliarioDisponibilidad: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('access-token'),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usuariosService as unknown as UsuariosService,
      jwtService as unknown as JwtService,
    );
  });

  it('permite el login de un domiciliario con clave temporal sin confirmacion previa', async () => {
    usuariosService.findByEmail.mockResolvedValue({
      id: 'usuario-id',
      nombre: 'Domiciliario',
      email: 'domiciliario@example.com',
      password: 'hash',
      rol: Rol.DOMICILIARIO,
      email_confirmado: false,
    });
    usuariosService.validatePassword.mockResolvedValue(true);
    usuariosService.updateDomiciliarioDisponibilidad.mockResolvedValue({
      disponibilidad: 'available',
    });

    await expect(
      service.login({
        email: 'domiciliario@example.com',
        password: 'password123',
      }),
    ).resolves.toMatchObject({ accessToken: 'access-token' });
    expect(jwtService.sign).toHaveBeenCalled();
    expect(usuariosService.updateDomiciliarioDisponibilidad).toHaveBeenCalledWith(
      'usuario-id',
      'available',
    );
  });

  it('mantiene el login para un domiciliario confirmado', async () => {
    usuariosService.findByEmail.mockResolvedValue({
      id: 'usuario-id',
      nombre: 'Domiciliario',
      email: 'domiciliario@example.com',
      password: 'hash',
      rol: Rol.DOMICILIARIO,
      email_confirmado: true,
    });
    usuariosService.validatePassword.mockResolvedValue(true);
    usuariosService.updateDomiciliarioDisponibilidad.mockResolvedValue({
      disponibilidad: 'available',
    });

    await expect(
      service.login({
        email: 'domiciliario@example.com',
        password: 'password123',
      }),
    ).resolves.toMatchObject({ accessToken: 'access-token' });
  });
});
