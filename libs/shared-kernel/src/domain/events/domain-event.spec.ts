import { DomainEvent } from './domain-event';

class TestEvent extends DomainEvent {}

describe('DomainEvent', () => {
  it('stamps occurredAt with the current time on creation', () => {
    const before = Date.now();
    const event = new TestEvent();
    const after = Date.now();

    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after);
  });
});
