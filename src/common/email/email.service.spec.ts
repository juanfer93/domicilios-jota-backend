import * as nodemailer from 'nodemailer';
import {
  buildDomiciliarioInvitationLinks,
  EmailService,
} from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('buildDomiciliarioInvitationLinks', () => {
  const originalAppScheme = process.env.APP_SCHEME;
  const originalInviteBaseUrl = process.env.APP_INVITE_BASE_URL;
  const originalApkUrl = process.env.APK_DOWNLOAD_URL;

  afterEach(() => {
    process.env.APP_SCHEME = originalAppScheme;
    process.env.APP_INVITE_BASE_URL = originalInviteBaseUrl;
    process.env.APK_DOWNLOAD_URL = originalApkUrl;
  });

  it('genera enlace de confirmacion, login de app y fallback de instalacion', () => {
    process.env.APP_INVITE_BASE_URL = 'https://api.jota.example/api/v1';
    process.env.APP_SCHEME = 'jotadeliverymobile';
    process.env.APK_DOWNLOAD_URL = 'pending-apk-url';

    expect(buildDomiciliarioInvitationLinks('token con espacios')).toEqual({
      confirmUrl:
        'https://api.jota.example/api/v1/auth/domiciliarios/confirm?token=token%20con%20espacios',
      inviteUrl:
        'https://api.jota.example/api/v1/auth/domiciliarios/confirm?token=token%20con%20espacios',
      appUrl: 'jotadeliverymobile:///login',
      apkUrl: 'pending-apk-url',
    });
  });

  it('envia la clave temporal por correo sin incluir un enlace de confirmacion', async () => {
    const sendMail = jest.fn().mockResolvedValue({ rejected: [] });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.APK_DOWNLOAD_URL = 'https://jota.example/app.apk';

    const service = new EmailService();

    await service.enviarInvitacionDomiciliario(
      'Domiciliario <uno>',
      'domi@example.com',
      'ClaveTemporal123',
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Tu acceso temporal a Jota Delivery',
        text: expect.stringContaining('Clave temporal: ClaveTemporal123'),
        html: expect.stringContaining('Domiciliario &lt;uno&gt;'),
      }),
    );
    expect(sendMail.mock.calls[0][0].text).not.toContain('Confirma tu cuenta');
  });
});
