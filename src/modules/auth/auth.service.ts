import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetPasswordDomiciliarioDto } from './dto/set-password-domiciliario.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Rol } from '../usuarios/enums/rol.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const usuario = await this.usuariosService.create({
      ...registerDto,
      rol: Rol.CLIENTE,
    });

    const tokens = this.generateTokens(usuario);

    return {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const usuario = await this.usuariosService.findByEmail(email);

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await this.usuariosService.validatePassword(
      password,
      usuario.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = this.generateTokens(usuario);

    return {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
      ...tokens,
    };
  }

  private generateTokens(usuario: any) {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

   async confirmarDomiciliario(token: string): Promise<void> {
    const usuario = await this.usuariosService.findByConfirmationToken(token);

    if (!usuario || usuario.rol !== Rol.DOMICILIARIO) {
      throw new BadRequestException('Token inválido');
    }

    if (
      !usuario.email_confirmacion_expira ||
      usuario.email_confirmacion_expira < new Date()
    ) {
      throw new BadRequestException('El enlace de confirmación ha expirado');
    }

    await this.usuariosService.marcarEmailConfirmado(usuario);
  }

  async validateUser(email: string, password: string) {
    const usuario = await this.usuariosService.findByEmail(email);

    if (!usuario || !usuario.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.rol === Rol.DOMICILIARIO && !usuario.email_confirmado) {
      throw new UnauthorizedException(
        'Debes confirmar tu cuenta antes de iniciar sesión',
      );
    }

    return usuario;
  }

    async setPasswordDomiciliario(dto: SetPasswordDomiciliarioDto) {
    const { token, password } = dto;

    const usuario = await this.usuariosService.findByConfirmationToken(token);

    if (!usuario || usuario.rol !== Rol.DOMICILIARIO) {
      throw new BadRequestException('Token inválido');
    }

    if (
      !usuario.email_confirmacion_expira ||
      usuario.email_confirmacion_expira < new Date()
    ) {
      throw new BadRequestException('El enlace de confirmación ha expirado');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    usuario.password = passwordHash;

    await this.usuariosService.marcarEmailConfirmado(usuario);

    return {
      message: 'Contraseña creada correctamente. Ya puedes iniciar sesión.',
    };
  }


}