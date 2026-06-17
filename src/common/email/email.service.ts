import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export function buildDomiciliarioAppOpenData(token: string) {
  const backendUrl = (
    process.env.APP_INVITE_BASE_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    'http://localhost:3000/api/v1'
  ).replace(/\/$/, '');

  const appScheme = process.env.APP_SCHEME || 'jotadeliverymobile';
  const apkUrl = process.env.APK_DOWNLOAD_URL || '#';
  const encodedToken = encodeURIComponent(token);

  return {
    confirmUrl: `${backendUrl}/auth/domiciliarios/confirm?token=${encodedToken}`,
    inviteUrl: `${backendUrl}/auth/domiciliarios/confirm?token=${encodedToken}`,
    appUrl: `${appScheme}:///login`,
    apkUrl,
  };
}

export function buildDomiciliarioInvitationLinks(token: string) {
  return buildDomiciliarioAppOpenData(token);
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true';

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP no configurado (SMTP_HOST/SMTP_USER/SMTP_PASS). Se hará solo log del email, no se enviará realmente.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async enviarInvitacionDomiciliario(
    nombre: string,
    email: string,
    _passwordTemporal: string,
    token: string,
  ) {
    const { confirmUrl, appUrl, apkUrl } =
      buildDomiciliarioInvitationLinks(token);

    const subject = 'Confirma tu cuenta de domiciliario';

    const text = `
Hola ${nombre},

Has sido registrado como domiciliario en la plataforma de Jota Delivery.

Confirma tu cuenta aquí:
${confirmUrl}

Instala la APK si aún no tienes la app:
${apkUrl}

Después de confirmar tu cuenta, entra a la app con el correo registrado y la clave temporal entregada por el administrador.

Si quieres cambiar tu clave después, entra a Perfil dentro de la app.

Si tú no esperabas este correo, puedes ignorarlo.

Saludos.
    `.trim();

    const html = `
      <p>Hola <strong>${nombre}</strong>,</p>

      <p>Has sido registrado como <strong>domiciliario</strong> en la plataforma de Jota Delivery.</p>

      <p>
        Primero confirma tu cuenta. Luego instala la APK si aún no tienes la app
        e inicia sesión con el correo registrado y la clave temporal entregada por el administrador.
      </p>

      <p>
        <a href="${confirmUrl}"
           style="display:inline-block;padding:12px 18px;background:#174A8B;color:#fff;
                  text-decoration:none;border-radius:8px;font-weight:700;">
          Confirmar cuenta
        </a>
      </p>

      <p>
        <a href="${apkUrl}"
           style="display:inline-block;padding:12px 18px;background:#F0E2BD;color:#174A8B;
                  text-decoration:none;border-radius:8px;font-weight:700;">
          Instalar APK
        </a>
      </p>

      <p>Si deseas cambiar tu clave, ve a <strong>Perfil</strong> dentro de la app.</p>
      <p>Enlace directo para abrir la app: <a href="${appUrl}">${appUrl}</a></p>
      <p>Si tú no esperabas este correo, puedes ignorarlo.</p>
      <p>Saludos.</p>
    `;

    this.logger.log(`Preparando email de confirmacion para domiciliario ${email}`);

    if (!this.transporter) {
      this.logger.warn(
        'No hay transporter de correo configurado. Solo se realizó log del mensaje, no se envió email real.',
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from:
          process.env.EMAIL_FROM ||
          '"Plataforma de Domicilios" <no-reply@localhost>',
        to: email,
        subject,
        text,
        html,
      });

      this.logger.log(`Email de confirmación enviado correctamente a ${email}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error enviando email a ${email}: ${message}`, stack);
    }
  }
}