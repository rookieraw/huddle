import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendContactRequestDto } from './send-contact-request.dto';

describe('SendContactRequestDto', () => {
  async function validateInput(input: Record<string, unknown>) {
    const dto = plainToInstance(SendContactRequestDto, input);
    return validate(dto);
  }

  it('rejects a missing target user identifier', async () => {
    const errors = await validateInput({});

    expect(errors.some((error) => error.property === 'targetUserId')).toBe(
      true,
    );
  });

  it('rejects a non-string target user identifier', async () => {
    const errors = await validateInput({ targetUserId: 12345 });
    const targetUserIdError = errors.find(
      (error) => error.property === 'targetUserId',
    );

    expect(targetUserIdError?.constraints).toHaveProperty('isString');
  });

  it('rejects an empty target user identifier', async () => {
    const errors = await validateInput({ targetUserId: '' });
    const targetUserIdError = errors.find(
      (error) => error.property === 'targetUserId',
    );

    expect(targetUserIdError?.constraints).toHaveProperty('isNotEmpty');
  });

  it.each(['user-target', ' '])(
    'accepts the non-empty string %p as a target user identifier',
    async (targetUserId) => {
      const errors = await validateInput({ targetUserId });

      expect(errors).toHaveLength(0);
    },
  );

  it('removes a client-supplied requester identifier as an unsupported field', async () => {
    const dto = plainToInstance(SendContactRequestDto, {
      targetUserId: 'user-target',
      requesterId: 'user-spoofed',
    });
    const errors = await validate(dto, { whitelist: true });

    expect(errors).toHaveLength(0);
    expect(dto).toHaveProperty('targetUserId', 'user-target');
    expect(dto).not.toHaveProperty('requesterId');
  });
});
