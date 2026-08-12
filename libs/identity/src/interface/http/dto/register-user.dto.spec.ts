import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterUserDto } from './register-user.dto';

describe('RegisterUserDto', () => {
  async function validateInput(input: Record<string, unknown>) {
    const dto = plainToInstance(RegisterUserDto, input);
    return validate(dto);
  }

  it('accepts a valid email, password, and display name', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'correct-horse-battery',
      displayName: 'Ada Lovelace',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing email', async () => {
    const errors = await validateInput({
      password: 'correct-horse-battery',
      displayName: 'Ada Lovelace',
    });

    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a malformed email', async () => {
    const errors = await validateInput({
      email: 'not-an-email',
      password: 'correct-horse-battery',
      displayName: 'Ada Lovelace',
    });

    const emailError = errors.find((e) => e.property === 'email');
    expect(emailError?.constraints).toHaveProperty('isEmail');
  });

  it('rejects a missing password', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      displayName: 'Ada Lovelace',
    });

    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a non-string password', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 12345678,
      displayName: 'Ada Lovelace',
    });

    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError?.constraints).toHaveProperty('isString');
  });

  it('rejects a password shorter than 8 characters', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'short',
      displayName: 'Ada Lovelace',
    });

    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError?.constraints).toHaveProperty('minLength');
  });

  it('rejects a missing display name', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'correct-horse-battery',
    });

    expect(errors.some((e) => e.property === 'displayName')).toBe(true);
  });

  it('rejects a non-string display name', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'correct-horse-battery',
      displayName: 12345,
    });

    const displayNameError = errors.find((e) => e.property === 'displayName');
    expect(displayNameError?.constraints).toHaveProperty('isString');
  });

  it('rejects a whitespace-only display name', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'correct-horse-battery',
      displayName: '   ',
    });

    const displayNameError = errors.find((e) => e.property === 'displayName');
    expect(displayNameError?.constraints).toHaveProperty('isNotBlank');
  });

  it('rejects an empty display name', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'correct-horse-battery',
      displayName: '',
    });

    const displayNameError = errors.find((e) => e.property === 'displayName');
    expect(displayNameError?.constraints).toHaveProperty('isNotBlank');
  });

  it('rejects a display name over 50 characters', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'correct-horse-battery',
      displayName: 'A'.repeat(51),
    });

    const displayNameError = errors.find((e) => e.property === 'displayName');
    expect(displayNameError?.constraints).toHaveProperty('maxLength');
  });

  it('accepts a display name exactly 50 characters long', async () => {
    const errors = await validateInput({
      email: 'ada@example.com',
      password: 'correct-horse-battery',
      displayName: 'A'.repeat(50),
    });

    expect(errors.some((e) => e.property === 'displayName')).toBe(false);
  });
});
