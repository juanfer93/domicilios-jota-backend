import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetPasswordDomiciliarioDto } from './dto/set-password-domiciliario.dto';
import { buildDomiciliarioAppOpenData } from '../../common/email/email.service';

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

  @Get('domiciliarios/open-app')
  openDomiciliarioApp(@Query('token') token: string, @Res() response: Response) {
    const data = buildDomiciliarioAppOpenData(token || '');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jota Delivery</title><style>body{font-family:Arial,sans-serif;background:#f7f1df;color:#12304f;margin:0;padding:32px}main{max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:28px;box-shadow:0 12px 30px #0001}a,button{display:block;width:100%;box-sizing:border-box;border:0;border-radius:12px;padding:14px 16px;margin-top:14px;text-align:center;text-decoration:none;font-weight:700}.primary{background:#174A8B;color:#fff}.secondary{background:#f0e2bd;color:#174A8B}p{line-height:1.5}</style></head><body><main><h1>Abre Jota Delivery</h1><p>Para crear tu contraseña debes abrir la aplicación de Jota Delivery. Si aún no la tienes instalada, instala primero la APK y luego vuelve a abrir este enlace desde tu correo.</p><a class="primary" href="${data.appUrl}">Abrir app</a><a class="secondary" href="${data.apkUrl}">Instalar APK</a></main><script>setTimeout(function(){window.location.href='${data.appUrl}'},300)</script></body></html>`;
    response.type('html').send(html);
  }

  @Post('domiciliarios/set-password')
  setPasswordDomiciliario(@Body() dto: SetPasswordDomiciliarioDto) {
    return this.authService.setPasswordDomiciliario(dto);
  }
}
