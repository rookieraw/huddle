import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterUserDto } from './register-user.dto';

describe('RegisterUserDto', () => {
  async function validateInput(input: Record<string, unknown>) {
    const dto = plainToInstance(RegisterUserDto, input);
    return validate(dto);
  }

  it('accepts a valid email and password', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'correct-horse-battery',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing email', async () => {
    const errors = await validateInput({
      password: 'correct-horse-battery',
    });

    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a malformed email', async () => {
    const errors = await validateInput({
      email: 'not-an-email',
      password: 'correct-horse-battery',
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

  it('rejects a password shorter than 8 characters', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'short',
    });

    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError?.constraints).toHaveProperty('minLength');
  });
});
