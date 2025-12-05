import { Controller, 
  Post, 
  Body, 
  HttpCode, 
  HttpStatus, 
  Get, 
  Query, 
  BadRequestException 
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetPasswordDomiciliarioDto } from './dto/set-password-domiciliario.dto';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('confirmar-domiciliario')
  async confirmarDomiciliario(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token requerido');
    }

    await this.authService.confirmarDomiciliario(token);

    return {
      message: 'Cuenta confirmada. Ya puedes iniciar sesión.',
    };
  }

    @Post('domiciliarios/set-password')
  async setPasswordDomiciliario(
    @Body() dto: SetPasswordDomiciliarioDto,
  ) {
    return this.authService.setPasswordDomiciliario(dto);
  }
}