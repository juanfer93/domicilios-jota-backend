import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsuariosRepository } from './repositories/usuarios.repository';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { CreateDomiciliarioDto } from './dto/create-domiciliario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailService } from '../../common/email/email.service';
import { Usuario } from './entities/usuario.entity';
import { Rol } from './enums/rol.enum';
import { DisponibilidadDomiciliario } from './enums/disponibilidad-domiciliario.enum';
import { randomBytes } from 'crypto';
import { getColombiaDateKey, getColombiaDayRange } from '../../common/time/colombia-time';

const COURIER_PRESENCE_TTL_MS = 2 * 60 * 1000;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly usuariosRepository: UsuariosRepository,
    private readonly emailService: EmailService,
  ) { }

  async create(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    const { email, password, ...rest } = createUsuarioDto;

    const existingUser = await this.usuariosRepository.existsByEmail(email);

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const usuario = this.usuariosRepository.create({
      ...rest,
      email,
      password: hashedPassword,
    });

    return this.usuariosRepository.save(usuario);
  }

  async findOne(id: string): Promise<Usuario> {
    const usuario = await this.usuariosRepository.findOne({ where: { id } });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return usuario;
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.usuariosRepository.findByEmail(email);
  }

  async findOneWithPedidos(id: string): Promise<Usuario & { gananciaDia?: number }> {
    const usuario = await this.usuariosRepository.findByIdWithPedidos(id);

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (usuario.rol !== Rol.DOMICILIARIO) {
      return usuario;
    }

    const { start, end } = getColombiaDayRange(getColombiaDateKey());
    const gananciaDia =
      await this.usuariosRepository.sumGananciaDiariaDomiciliario(
        usuario.id,
        start,
        end,
      );

    return Object.assign(usuario, { gananciaDia });
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async getAdminStatus() {
    const admin = await this.usuariosRepository.findOne({
      where: { rol: Rol.ADMIN },
      order: { createdAt: 'ASC' },
    });

    return {
      hasAdmin: !!admin,
      adminName: admin?.nombre ?? null,
    };
  }

  async createFirstAdmin(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    const hasAdmin = await this.usuariosRepository.hasAdmin();

    if (hasAdmin) {
      throw new ConflictException('Ya existe un administrador');
    }

    const existingUser = await this.usuariosRepository.existsByEmail(
      createUsuarioDto.email,
    );

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      createUsuarioDto.password,
      saltRounds,
    );

    const admin = this.usuariosRepository.create({
      nombre: createUsuarioDto.nombre,
      email: createUsuarioDto.email,
      password: hashedPassword,
      rol: Rol.ADMIN,
    });

    return this.usuariosRepository.save(admin);
  }

  private async hashPassword(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
  }

  private generarPasswordTemporal(): string {
    return randomBytes(12).toString('base64url');
  }

  private resolveDomiciliarioDisponibilidad(
    usuario: Pick<Usuario, 'disponibilidad' | 'lastSeenAt'>,
  ): DisponibilidadDomiciliario {
    if (usuario.disponibilidad === DisponibilidadDomiciliario.OFFLINE) {
      return DisponibilidadDomiciliario.OFFLINE;
    }

    if (!usuario.lastSeenAt) {
      return DisponibilidadDomiciliario.OFFLINE;
    }

    const lastSeenAt = new Date(usuario.lastSeenAt).getTime();
    return Date.now() - lastSeenAt <= COURIER_PRESENCE_TTL_MS
      ? DisponibilidadDomiciliario.AVAILABLE
      : DisponibilidadDomiciliario.OFFLINE;
  }

  async createDomiciliario(
    dto: CreateDomiciliarioDto,
  ): Promise<Usuario & { passwordTemporal: string }> {
    const { nombre, email } = dto;

    const existente = await this.usuariosRepository.findOne({
      where: { email },
    });

    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const passwordTemporal = this.generarPasswordTemporal();
    const passwordHash = await this.hashPassword(passwordTemporal);

    const usuario = this.usuariosRepository.create({
      nombre,
      email,
      password: passwordHash,
      rol: Rol.DOMICILIARIO,
      email_confirmado: true,
      email_confirmacion_token: null,
      email_confirmacion_expira: null,
    });

    const guardado = await this.usuariosRepository.save(usuario);

    try {
      await this.emailService.enviarInvitacionDomiciliario(
        nombre,
        email,
        passwordTemporal,
      );
    } catch (error) {
      await this.usuariosRepository.remove(guardado);
      throw error;
    }

    return Object.assign(guardado, { passwordTemporal });
  }

  async findAllDomiciliarios(): Promise<
    Pick<
      Usuario,
      'id' | 'nombre' | 'email' | 'bloqueado' | 'email_confirmado' | 'createdAt'
      | 'disponibilidad'
    >[]
  > {
    const domiciliarios = await this.usuariosRepository.find({
      where: { rol: Rol.DOMICILIARIO },
      select: [
        'id',
        'nombre',
        'email',
        'bloqueado',
        'email_confirmado',
        'disponibilidad',
        'lastSeenAt',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });

    return domiciliarios.map((domi) => ({
      id: domi.id,
      nombre: domi.nombre,
      email: domi.email,
      bloqueado: domi.bloqueado,
      email_confirmado: domi.email_confirmado,
      disponibilidad: this.resolveDomiciliarioDisponibilidad(domi),
      createdAt: domi.createdAt,
    }));
  }

  async searchDomiciliarios(
    nombre: string,
  ): Promise<
    Pick<
      Usuario,
      'id' | 'nombre' | 'email' | 'bloqueado' | 'createdAt' | 'disponibilidad'
    >[]
  > {
    const domiciliarios =
      await this.usuariosRepository.findDomiciliariosByNombre(nombre.trim());

    return domiciliarios.map((domi) => ({
      id: domi.id,
      nombre: domi.nombre,
      email: domi.email,
      bloqueado: domi.bloqueado,
      disponibilidad: this.resolveDomiciliarioDisponibilidad(domi),
      createdAt: domi.createdAt,
    }));
  }

  async updateDomiciliarioDisponibilidad(
    id: string,
    disponibilidad: DisponibilidadDomiciliario,
  ): Promise<
    Pick<
      Usuario,
      | 'id'
      | 'nombre'
      | 'email'
      | 'bloqueado'
      | 'email_confirmado'
      | 'createdAt'
      | 'disponibilidad'
    >
  > {
    const domi = await this.usuariosRepository.findOne({
      where: { id, rol: Rol.DOMICILIARIO },
    });

    if (!domi) {
      throw new NotFoundException('Domiciliario no encontrado');
    }

    domi.disponibilidad = disponibilidad;
    domi.lastSeenAt =
      disponibilidad === DisponibilidadDomiciliario.AVAILABLE ? new Date() : null;
    const guardado = await this.usuariosRepository.save(domi);

    return {
      id: guardado.id,
      nombre: guardado.nombre,
      email: guardado.email,
      bloqueado: guardado.bloqueado,
      email_confirmado: guardado.email_confirmado,
      disponibilidad: this.resolveDomiciliarioDisponibilidad(guardado),
      createdAt: guardado.createdAt,
    };
  }

  async touchDomiciliarioPresence(
    id: string,
  ): Promise<Pick<Usuario, 'id' | 'disponibilidad'>> {
    const domi = await this.usuariosRepository.findOne({
      where: { id, rol: Rol.DOMICILIARIO },
    });

    if (!domi) {
      throw new NotFoundException('Domiciliario no encontrado');
    }

    if (domi.disponibilidad === DisponibilidadDomiciliario.AVAILABLE) {
      domi.lastSeenAt = new Date();
      await this.usuariosRepository.save(domi);
    }

    return {
      id: domi.id,
      disponibilidad: this.resolveDomiciliarioDisponibilidad(domi),
    };
  }

  async toggleBloqueo(
    id: string,
    bloqueado: boolean,
  ): Promise<
    Pick<
      Usuario,
      'id' | 'nombre' | 'email' | 'bloqueado' | 'createdAt' | 'disponibilidad'
    >
  > {
    const domi = await this.usuariosRepository.findOne({
      where: { id, rol: Rol.DOMICILIARIO },
    });

    if (!domi) {
      throw new NotFoundException('Domiciliario no encontrado');
    }

    domi.bloqueado = bloqueado;

    const guardado = await this.usuariosRepository.save(domi);

    return {
      id: guardado.id,
      nombre: guardado.nombre,
      email: guardado.email,
      bloqueado: guardado.bloqueado,
      disponibilidad: this.resolveDomiciliarioDisponibilidad(guardado),
      createdAt: guardado.createdAt,
    };
  }

  async changeCurrentUserPassword(userId: string, dto: ChangePasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const usuario = await this.findOne(userId);
    usuario.password = await this.hashPassword(dto.password);

    await this.usuariosRepository.save(usuario);

    return {
      message: 'Contraseña actualizada correctamente.',
    };
  }

  async findByConfirmationToken(token: string): Promise<Usuario | null> {
    return this.usuariosRepository.findOne({
      where: { email_confirmacion_token: token },
    });
  }

  async marcarEmailConfirmado(usuario: Usuario): Promise<void> {
    usuario.email_confirmado = true;
    usuario.email_confirmacion_token = null;
    usuario.email_confirmacion_expira = null;

    await this.usuariosRepository.save(usuario);
  }
}
