import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosRepository } from './repositories/usuarios.repository';
import { Rol } from './enums/rol.enum';
import { Usuario } from './entities/usuario.entity';
import { EmailService } from '../../common/email/email.service';

const makeDomiciliario = (overrides = {}): Partial<Usuario> => ({
  id: 'domi-uuid',
  nombre: 'Juan Domiciliario',
  email: 'juan@domi.com',
  rol: Rol.DOMICILIARIO,
  bloqueado: false,
  email_confirmado: false,
  createdAt: new Date('2026-06-17T12:00:00.000Z'),
  ...overrides,
});

describe('UsuariosService - domiciliarios', () => {
  let service: UsuariosService;

  const usuariosRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(),
    existsByEmail: jest.fn(),
    hasAdmin: jest.fn(),
    findByEmail: jest.fn(),
    findByIdWithPedidos: jest.fn(),
    findDomiciliariosByNombre: jest.fn(),
    sumGananciaDiariaDomiciliario: jest.fn(),
    count: jest.fn(),
  };

  const emailService = {
    enviarInvitacionDomiciliario: jest.fn(),
  } as unknown as EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsuariosService(
      usuariosRepository as unknown as UsuariosRepository,
      emailService,
    );
  });

  it('crea domiciliario, envia correo y retorna clave temporal', async () => {
    const created = makeDomiciliario({ id: 'domi-created' });
    const saved = makeDomiciliario({ id: 'domi-created' }) as Usuario;

    usuariosRepository.findOne.mockResolvedValue(null);
    usuariosRepository.create.mockReturnValue(created);
    usuariosRepository.save.mockResolvedValue(saved);
    (emailService.enviarInvitacionDomiciliario as jest.Mock).mockResolvedValue(undefined);

    const result = await service.createDomiciliario({
      nombre: 'Juan Domiciliario',
      email: 'juan@domi.com',
    });

    expect(usuariosRepository.save).toHaveBeenCalledWith(created);
    expect(emailService.enviarInvitacionDomiciliario).toHaveBeenCalledWith(
      'Juan Domiciliario',
      'juan@domi.com',
      expect.any(String),
    );
    expect(result.passwordTemporal).toMatch(/^[A-Za-z0-9_-]{16}$/);
    const passwordSentByEmail = (
      emailService.enviarInvitacionDomiciliario as jest.Mock
    ).mock.calls[0][2] as string;
    const createdDomiciliario = usuariosRepository.create.mock.calls[0][0] as Usuario;
    expect(
      await service.validatePassword(passwordSentByEmail, createdDomiciliario.password),
    ).toBe(true);
    expect(usuariosRepository.remove).not.toHaveBeenCalled();
  });

  it('elimina el domiciliario si el correo de confirmacion falla', async () => {
    const created = makeDomiciliario({ id: 'domi-created' });
    const saved = makeDomiciliario({ id: 'domi-created' }) as Usuario;

    usuariosRepository.findOne.mockResolvedValue(null);
    usuariosRepository.create.mockReturnValue(created);
    usuariosRepository.save.mockResolvedValue(saved);
    usuariosRepository.remove.mockResolvedValue(saved);
    (emailService.enviarInvitacionDomiciliario as jest.Mock).mockRejectedValue(
      new ServiceUnavailableException('SMTP no configurado'),
    );

    await expect(
      service.createDomiciliario({
        nombre: 'Juan Domiciliario',
        email: 'juan@domi.com',
      }),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(usuariosRepository.remove).toHaveBeenCalledWith(saved);
  });

  it('bloquea un domiciliario existente → retorna bloqueado=true', async () => {
    const domi = makeDomiciliario({ bloqueado: false });
    usuariosRepository.findOne.mockResolvedValue(domi);
    usuariosRepository.save.mockResolvedValue({ ...domi, bloqueado: true });

    const result = await service.toggleBloqueo('domi-uuid', true);

    expect(usuariosRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ bloqueado: true }),
    );
    expect(result.bloqueado).toBe(true);
  });

  it('desbloquea un domiciliario existente → retorna bloqueado=false', async () => {
    const domi = makeDomiciliario({ bloqueado: true });
    usuariosRepository.findOne.mockResolvedValue(domi);
    usuariosRepository.save.mockResolvedValue({ ...domi, bloqueado: false });

    const result = await service.toggleBloqueo('domi-uuid', false);

    expect(result.bloqueado).toBe(false);
  });

  it('lanza NotFoundException si el domiciliario no existe', async () => {
    usuariosRepository.findOne.mockResolvedValue(null);

    await expect(
      service.toggleBloqueo('no-existe', true),
    ).rejects.toThrow(NotFoundException);
  });

  it('findAllDomiciliarios incluye el campo bloqueado', async () => {
    const domiciliarios = [
      makeDomiciliario({ bloqueado: false }),
      makeDomiciliario({ id: 'domi-2', bloqueado: true }),
    ];
    usuariosRepository.find.mockResolvedValue(domiciliarios);

    const result = await service.findAllDomiciliarios();

    expect(result[0]).toHaveProperty('bloqueado');
    expect(result[1].bloqueado).toBe(true);
  });

  it('busca domiciliarios por nombre normalizado', async () => {
    const domiciliarios = [makeDomiciliario({ nombre: 'Juan Perez' })];
    usuariosRepository.findDomiciliariosByNombre.mockResolvedValue(domiciliarios);

    const result = await service.searchDomiciliarios('  juan  ');

    expect(usuariosRepository.findDomiciliariosByNombre).toHaveBeenCalledWith('juan');
    expect(result).toEqual(domiciliarios);
  });

  it('retorna ganancia diaria calculada para el perfil del domiciliario', async () => {
    const domi = makeDomiciliario({ email_confirmado: true }) as Usuario;
    usuariosRepository.findByIdWithPedidos.mockResolvedValue(domi);
    usuariosRepository.sumGananciaDiariaDomiciliario.mockResolvedValue(18000);

    const result = await service.findOneWithPedidos('domi-uuid');

    expect(result.gananciaDia).toBe(18000);
    expect(usuariosRepository.sumGananciaDiariaDomiciliario).toHaveBeenCalledWith(
      'domi-uuid',
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('no calcula ganancia diaria para perfil administrador', async () => {
    const admin = makeDomiciliario({
      id: 'admin-uuid',
      rol: Rol.ADMIN,
    }) as Usuario;
    usuariosRepository.findByIdWithPedidos.mockResolvedValue(admin);

    const result = await service.findOneWithPedidos('admin-uuid');

    expect(result).not.toHaveProperty('gananciaDia');
    expect(usuariosRepository.sumGananciaDiariaDomiciliario).not.toHaveBeenCalled();
  });
});
