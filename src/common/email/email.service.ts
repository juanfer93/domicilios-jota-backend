import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

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
    const frontendUrl =
      process.env.FRONTEND_URL || 'http://localhost:3001';

    const urlConfirmacion = `${frontendUrl}/create-password?token=${token}`;

    // Contenido del correo
    const subject = 'Invitación como domiciliario';
    const text = `
Hola ${nombre},

Has sido registrado como domiciliario en la plataforma de domicilios.

Tu contraseña temporal es: ${passwordTemporal}

Por favor haz clic en el siguiente enlace para crear tu nueva contraseña:
${urlConfirmacion}

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
        <a href="${urlConfirmacion}" 
           style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;
                  text-decoration:none;border-radius:4px;">
          Crear contraseña
        </a>
      </p>
      <p>O copia y pega este enlace en tu navegador:</p>
      <p><a href="${urlConfirmacion}">${urlConfirmacion}</a></p>
      <p>Si tú no esperabas este correo, puedes ignorarlo.</p>
      <p>Saludos.</p>
    `;

    this.logger.log(
      `Preparando email de invitación para ${email} con link ${urlConfirmacion}`,
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
    } catch (error) {
      this.logger.error(
        `Error enviando email a ${email}: ${error.message}`,
        error.stack,
      );
      // Si quieres, aquí podrías lanzar una excepción para que falle la creación.
      // throw new InternalServerErrorException('No se pudo enviar el email');
    }
  }
}
