import { validate } from 'class-validator';
import { SetPasswordDomiciliarioDto } from './set-password-domiciliario.dto';

describe('SetPasswordDomiciliarioDto', () => {
  it('rechaza contraseñas de menos de 8 caracteres', async () => {
    const dto = new SetPasswordDomiciliarioDto();
    dto.token = 'token-valido';
    dto.password = '1234567';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('acepta contraseñas de 8 caracteres o más', async () => {
    const dto = new SetPasswordDomiciliarioDto();
    dto.token = 'token-valido';
    dto.password = '12345678';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
