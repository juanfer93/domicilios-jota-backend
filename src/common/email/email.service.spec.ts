import { buildDomiciliarioInvitationLinks } from './email.service';

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
});