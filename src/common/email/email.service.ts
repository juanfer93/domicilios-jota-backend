import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export function buildDomiciliarioInvitationLinks(token: string) {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://192.168.1.26:8081').replace(/\/$/, '');
  const appScheme = process.env.APP_SCHEME || 'jotadeliverymobile';
  const path = `auth/domiciliario/set-password?token=${encodeURIComponent(token)}`;

  return {
    webUrl: `${frontendUrl}/${path}`,
    androidUrl: `${appScheme}://${path}`,
  };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT
      ? Number(process.env.SMTP_PORT)
      : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true';

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP no configurado (SMTP_HOST/SMTP_USER/SMTP_PASS). ' +
        'Se hará solo log del email, no se enviará realmente.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  async enviarInvitacionDomiciliario(
    nombre: string,
    email: string,
    passwordTemporal: string,
    token: string,
  ) {
    const { webUrl, androidUrl } = buildDomiciliarioInvitationLinks(token);
    const subject = 'Invitación como domiciliario';
    const text = `
Hola ${nombre},

Has sido registrado como domiciliario en la plataforma de domicilios.

Tu contraseña temporal es: ${passwordTemporal}

Por favor haz clic en el siguiente enlace para crear tu nueva contraseña:
Android: ${androidUrl}
Web: ${webUrl}

Si tú no esperabas este correo, puedes ignorarlo.

Saludos.
    `.trim();

    const html = `
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Has sido registrado como <strong>domiciliario</strong> en la plataforma de Jota domicilios.</p>
      <p>Tu contraseña temporal es: <strong>${passwordTemporal}</strong></p>
      <p>
        Por favor haz clic en el siguiente botón o enlace para crear tu nueva contraseña:
      </p>
      <p>
        <a href="${androidUrl}"
           style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;
                  text-decoration:none;border-radius:4px;">
          Abrir app Android
        </a>
      </p>
      <p>
        <a href="${webUrl}"
           style="display:inline-block;padding:10px 16px;background:#174A8B;color:#fff;
                  text-decoration:none;border-radius:4px;">
          Continuar en la web
        </a>
      </p>
      <p>O copia y pega este enlace en tu navegador:</p>
      <p><a href="${webUrl}">${webUrl}</a></p>
      <p>Si tú no esperabas este correo, puedes ignorarlo.</p>
      <p>Saludos.</p>
    `;

    this.logger.log(
      `Preparando email de invitacion para ${email} con enlaces web y Android`,
    );

    if (!this.transporter) {
      this.logger.warn(
        'No hay transporter de correo configurado. ' +
        'Solo se realizó log del mensaje, no se envió email real.',
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

      this.logger.log(`Email de invitación enviado correctamente a ${email}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error enviando email a ${email}: ${message}`,
        stack,
      );
    }
  }
}
