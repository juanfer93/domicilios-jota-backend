import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuariosRepository } from './repositories/usuarios.repository';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { CreateDomiciliarioDto } from './dto/create-domiciliario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { EmailService } from 'src/common/email/email.service';
import { Usuario } from './entities/usuario.entity';
import { Rol } from './enums/rol.enum';
import { Pedido } from '../pedidos/entities/pedido.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly usuariosRepository: UsuariosRepository,
    @InjectRepository(Pedido)
    private readonly pedidosRepository: Repository<Pedido>,
    private readonly emailService: EmailService
  ) {}

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

  async findAll(): Promise<Usuario[]> {
    return this.usuariosRepository.find({
      order: { createdAt: 'DESC' },
    });
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

  async findOneWithPedidos(id: string): Promise<Usuario> {
    const usuario = await this.usuariosRepository.findByIdWithPedidos(id);

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return usuario;
  }

  async update(id: string, updateUsuarioDto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    Object.assign(usuario, updateUsuarioDto);
    return this.usuariosRepository.save(usuario);
  }

  async remove(id: string): Promise<void> {
    const usuario = await this.findOne(id);
    await this.usuariosRepository.remove(usuario);
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
      order: { createdAt: "ASC" },
    });

    return { hasAdmin: !!admin, adminName: admin?.nombre ?? null };
  }

  async createFirstAdmin(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    const hasAdmin = await this.usuariosRepository.hasAdmin();

    if (hasAdmin) {
      throw new ConflictException('Ya existe un administrador');
    }

    const existingUser = await this.usuariosRepository.existsByEmail(createUsuarioDto.email);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(createUsuarioDto.password, saltRounds);

    const admin = this.usuariosRepository.create({
      nombre: createUsuarioDto.nombre,
      email: createUsuarioDto.email,
      password: hashedPassword,
      rol: Rol.ADMIN,
    });

    return this.usuariosRepository.save(admin);
  }

  async getDashboardSummary() {
    const totalPedidos = await this.pedidosRepository.count()

    const totalDomiciliarios = await this.usuariosRepository.count({
      where: { rol: Rol.DOMICILIARIO }
    })

    return {
      totalPedidos,
      totalDomiciliarios
    }
  }

   private async hashPassword(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
  }

  private generarPasswordTemporal(): string {
    return Math.random().toString(36).slice(-10);
  }
  
  async createDomiciliario(dto: CreateDomiciliarioDto): Promise<Usuario> {
    const { nombre, email } = dto;

    const existente = await this.usuariosRepository.findOne({ where: { email } });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const passwordTemporal = this.generarPasswordTemporal();
    const passwordHash = await this.hashPassword(passwordTemporal);

    const token = randomUUID();
    const expira = new Date();
    expira.setHours(expira.getHours() + 24); // 24 horas

    const usuario = this.usuariosRepository.create({
      nombre,
      email,
      password: passwordHash,
      rol: Rol.DOMICILIARIO,
      email_confirmado: false,
      email_confirmacion_token: token,
      email_confirmacion_expira: expira,
    });

    const guardado = await this.usuariosRepository.save(usuario);

    await this.emailService.enviarInvitacionDomiciliario(
      nombre,
      email,
      passwordTemporal,
      token,
    );

    return guardado;
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