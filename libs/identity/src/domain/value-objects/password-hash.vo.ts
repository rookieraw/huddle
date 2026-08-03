import * as argon2 from 'argon2';
import { DomainError } from '@huddle/shared-kernel';

export class PasswordHash {
  private constructor(private readonly hash: string) {}

  static async fromPlainText(plainPassword: string): Promise<PasswordHash> {
    if (plainPassword.length < 8) {
      throw new DomainError('Password must be at least 8 characters');
    }

    const hash = await argon2.hash(plainPassword, {
      type: argon2.argon2id,
    });

    return new PasswordHash(hash);
  }

  static fromHash(hash: string): PasswordHash {
    return new PasswordHash(hash);
  }

  async verify(plainPassword: string): Promise<boolean> {
    return argon2.verify(this.hash, plainPassword);
  }

  get value(): string {
    return this.hash;
  }
}
