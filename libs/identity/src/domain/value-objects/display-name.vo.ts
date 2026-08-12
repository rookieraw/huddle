import { DomainError } from '@huddle/shared-kernel';

const MAX_LENGTH = 50;

export class DisplayName {
  private constructor(private readonly _value: string) {}

  static create(raw: string): DisplayName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new DomainError('Display name must not be empty.');
    }

    if (trimmed.length > MAX_LENGTH) {
      throw new DomainError(
        `Display name must not exceed ${MAX_LENGTH} characters.`,
      );
    }

    return new DisplayName(trimmed);
  }

  static fromPersisted(value: string): DisplayName {
    return new DisplayName(value);
  }

  get value(): string {
    return this._value;
  }
}
