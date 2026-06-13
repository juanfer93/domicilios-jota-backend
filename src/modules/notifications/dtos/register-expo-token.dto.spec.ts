import { validate } from 'class-validator';
import { RegisterExpoTokenDto } from './register-expo-token.dto';

describe('RegisterExpoTokenDto', () => {
  it('acepta un token Expo de Android', async () => {
    const dto = Object.assign(new RegisterExpoTokenDto(), {
      token: 'ExponentPushToken[android-token]',
      platform: 'android',
      provider: 'EXPO',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['ios', 'web'])('rechaza la plataforma %s', async (platform) => {
    const dto = Object.assign(new RegisterExpoTokenDto(), {
      token: 'ExponentPushToken[android-token]',
      platform,
      provider: 'EXPO',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('rechaza un token que no tenga formato Expo Push', async () => {
    const dto = Object.assign(new RegisterExpoTokenDto(), {
      token: 'token-invalido',
      platform: 'android',
      provider: 'EXPO',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
