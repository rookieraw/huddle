import { DomainEvent } from '@huddle/shared-kernel';

export class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {
    super();
  }
}
