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

  it('genera el enlace del backend, el deep link de app y el fallback de instalacion', () => {
    process.env.APP_INVITE_BASE_URL = 'https://api.jota.example/api/v1';
    process.env.APP_SCHEME = 'jotadeliverymobile';
    process.env.APK_DOWNLOAD_URL = 'pending-apk-url';

    expect(buildDomiciliarioInvitationLinks('token con espacios')).toEqual({
      inviteUrl: 'https://api.jota.example/api/v1/auth/domiciliarios/open-app?token=token%20con%20espacios',
      appUrl: 'jotadeliverymobile:///auth/domiciliario/set-password?token=token%20con%20espacios',
      apkUrl: 'pending-apk-url',
    });
  });
});
