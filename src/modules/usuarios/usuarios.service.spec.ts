import { NotFoundException } from '@nestjs/common';
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
  ...overrides,
});

describe('UsuariosService - toggleBloqueo', () => {
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
});
