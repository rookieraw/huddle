import { DomainError } from './domain-error';

describe('DomainError', () => {
  it('carries the provided message', () => {
    const error = new DomainError('Something went wrong');

    expect(error.message).toBe('Something went wrong');
  });

  it('is an instance of Error', () => {
    const error = new DomainError('Something went wrong');

    expect(error).toBeInstanceOf(Error);
  });

  it('is an instance of DomainError', () => {
    const error = new DomainError('Something went wrong');

    expect(error).toBeInstanceOf(DomainError);
  });

  it('sets its name to DomainError', () => {
    const error = new DomainError('Something went wrong');

    expect(error.name).toBe('DomainError');
  });

  it('is distinguishable from a generic Error via instanceof', () => {
    const genericError = new Error('unrelated failure');

    expect(genericError).not.toBeInstanceOf(DomainError);
  });
});
