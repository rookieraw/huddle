import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginUserDto } from './login-user.dto';

describe('LoginUserDto', () => {
  async function validateInput(input: Record<string, unknown>) {
    const dto = plainToInstance(LoginUserDto, input);
    return validate(dto);
  }

  it('accepts a valid email and password', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'whatever-length',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing email', async () => {
    const errors = await validateInput({
      password: 'whatever-length',
    });

    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a malformed email', async () => {
    const errors = await validateInput({
      email: 'not-an-email',
      password: 'whatever-length',
    });

    const emailError = errors.find((e) => e.property === 'email');
    expect(emailError?.constraints).toHaveProperty('isEmail');
  });

  it('rejects a missing password', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
    });

    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a non-string password', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 12345678,
    });

    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError?.constraints).toHaveProperty('isString');
  });
});
