import { DomainError } from '@huddle/shared-kernel';
import { DisplayName } from './display-name.vo';

describe('DisplayName', () => {
  describe('create', () => {
    it('creates a DisplayName from valid trimmed text', () => {
      const displayName = DisplayName.create('Ada Lovelace');

      expect(displayName.value).toBe('Ada Lovelace');
    });

    it('trims leading and trailing whitespace', () => {
      const displayName = DisplayName.create('  Ada Lovelace  ');

      expect(displayName.value).toBe('Ada Lovelace');
    });

    it('accepts Unicode text', () => {
      const displayName = DisplayName.create('田中太郎');

      expect(displayName.value).toBe('田中太郎');
    });

    it('accepts a name exactly 1 character long after trimming', () => {
      const displayName = DisplayName.create('A');

      expect(displayName.value).toBe('A');
    });

    it('accepts a name exactly 50 characters long after trimming', () => {
      const fiftyChars = 'A'.repeat(50);

      const displayName = DisplayName.create(fiftyChars);

      expect(displayName.value).toBe(fiftyChars);
    });

    it('throws DomainError when the trimmed value is empty', () => {
      expect(() => DisplayName.create('   ')).toThrow(DomainError);
    });

    it('throws DomainError for an empty string', () => {
      expect(() => DisplayName.create('')).toThrow(DomainError);
    });

    it('throws DomainError when the trimmed value exceeds 50 characters', () => {
      const tooLong = 'A'.repeat(51);

      expect(() => DisplayName.create(tooLong)).toThrow(DomainError);
    });

    it('measures the 50-character limit after trimming, not before', () => {
      const fiftyCharsPadded = `  ${'A'.repeat(50)}  `;

      const displayName = DisplayName.create(fiftyCharsPadded);

      expect(displayName.value).toBe('A'.repeat(50));
    });

    it('counts a surrogate-pair character as one Unicode code point, matching class-validator', () => {
      const astralChar = String.fromCodePoint(0x1f600); // 😀, a UTF-16 surrogate pair
      const fiftyAstralChars = astralChar.repeat(50);

      const displayName = DisplayName.create(fiftyAstralChars);

      expect(displayName.value).toBe(fiftyAstralChars);
    });

    it('throws DomainError when the code-point length exceeds 50, even for surrogate-pair characters', () => {
      const astralChar = String.fromCodePoint(0x1f600);
      const fiftyOneAstralChars = astralChar.repeat(51);

      expect(() => DisplayName.create(fiftyOneAstralChars)).toThrow(
        DomainError,
      );
    });

    it('allows two different DisplayName instances to hold the same value', () => {
      const first = DisplayName.create('Ada Lovelace');
      const second = DisplayName.create('Ada Lovelace');

      expect(first.value).toBe(second.value);
    });
  });

  describe('fromPersisted', () => {
    it('reconstructs a DisplayName from a stored value without re-validating', () => {
      const displayName = DisplayName.fromPersisted('Ada Lovelace');

      expect(displayName.value).toBe('Ada Lovelace');
    });
  });
});
