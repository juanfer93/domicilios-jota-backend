import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export function buildDomiciliarioAppOpenData(token: string) {
  const backendUrl = (process.env.APP_INVITE_BASE_URL || process.env.BACKEND_PUBLIC_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
  const appScheme = process.env.APP_SCHEME || 'jotadeliverymobile';
  const apkUrl = process.env.APK_DOWNLOAD_URL || '#';
  const appPath = `auth/domiciliario/set-password?token=${encodeURIComponent(token)}`;
  return {
    inviteUrl: `${backendUrl}/auth/domiciliarios/open-app?token=${encodeURIComponent(token)}`,
    appUrl: `${appScheme}:///${appPath}`,
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
      this.logger.warn('SMTP no configurado (SMTP_HOST/SMTP_USER/SMTP_PASS). Se hará solo log del email, no se enviará realmente.');
      return;
    }

    this.transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  }

  async enviarInvitacionDomiciliario(nombre: string, email: string, passwordTemporal: string, token: string) {
    const { inviteUrl, appUrl, apkUrl } = buildDomiciliarioInvitationLinks(token);
    const subject = 'Invitación como domiciliario';
    const text = `
Hola ${nombre},

Has sido registrado como domiciliario en la plataforma de Jota Delivery.

Tu contraseña temporal es: ${passwordTemporal}

Debes tener instalada la app para crear tu contraseña.
Abre este enlace desde tu celular: ${inviteUrl}

Si no tienes la app instalada, instala la APK primero: ${apkUrl}

Si tú no esperabas este correo, puedes ignorarlo.

Saludos.
    `.trim();

    const html = `
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Has sido registrado como <strong>domiciliario</strong> en la plataforma de Jota Delivery.</p>
      <p>Tu contraseña temporal es: <strong>${passwordTemporal}</strong></p>
      <p><strong>Importante:</strong> para crear tu contraseña debes tener instalada la app.</p>
      <p>
        <a href="${inviteUrl}"
           style="display:inline-block;padding:12px 18px;background:#174A8B;color:#fff;
                  text-decoration:none;border-radius:8px;font-weight:700;">
          Abrir app y crear contraseña
        </a>
      </p>
      <p>Si el botón no abre la app, instala primero la APK y luego vuelve a abrir este correo.</p>
      <p><a href="${apkUrl}">Instalar APK</a></p>
      <p>Enlace directo de la app: <a href="${appUrl}">${appUrl}</a></p>
      <p>Si tú no esperabas este correo, puedes ignorarlo.</p>
      <p>Saludos.</p>
    `;

    this.logger.log(`Preparando email de invitacion para ${email} con enlace solo a app`);

    if (!this.transporter) {
      this.logger.warn('No hay transporter de correo configurado. Solo se realizó log del mensaje, no se envió email real.');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Plataforma de Domicilios" <no-reply@localhost>',
        to: email,
        subject,
        text,
        html,
      });
      this.logger.log(`Email de invitación enviado correctamente a ${email}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error enviando email a ${email}: ${message}`, stack);
    }
  }
}
