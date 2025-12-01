import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsuariosRepository } from './repositories/usuarios.repository';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Usuario } from './entities/usuario.entity';
import { Rol } from './enums/rol.enum';

@Injectable()
export class UsuariosService {
  constructor(private readonly usuariosRepository: UsuariosRepository) { }

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

  async getAdminStatus(): Promise<{ hasAdmin: boolean }> {
    const hasAdmin = await this.usuariosRepository.hasAdmin();
    return { hasAdmin };
  }

  async createFirstAdmin(createUsuarioDto: CreateUsuarioDto) {
    const hasAdmin = await this.usuariosRepository.hasAdmin();

    if (hasAdmin) {
      throw new NotFoundException('Ya existe un administrador');
    }

    const admin = this.usuariosRepository.create({
      nombre: createUsuarioDto.nombre,
      email: createUsuarioDto.email,
      password: createUsuarioDto.password,
      rol: Rol.ADMIN,
    });

    return this.usuariosRepository.save(admin);
  }
}