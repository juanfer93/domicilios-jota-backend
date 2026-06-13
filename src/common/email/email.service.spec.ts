import { buildDomiciliarioInvitationLinks } from './email.service';

describe('buildDomiciliarioInvitationLinks', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalAppScheme = process.env.APP_SCHEME;

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
    process.env.APP_SCHEME = originalAppScheme;
  });

  it('genera destinos web y Android para el mismo token', () => {
    process.env.FRONTEND_URL = 'https://jota.example/';
    process.env.APP_SCHEME = 'jotadeliverymobile';

    expect(buildDomiciliarioInvitationLinks('token con espacios')).toEqual({
      webUrl: 'https://jota.example/auth/domiciliario/set-password?token=token%20con%20espacios',
      androidUrl: 'jotadeliverymobile://auth/domiciliario/set-password?token=token%20con%20espacios',
    });
  });
});
