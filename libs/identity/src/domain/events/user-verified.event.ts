import { DomainEvent } from '@huddle/shared-kernel';

export class UserVerifiedEvent extends DomainEvent {
  constructor(public readonly userId: string) {
    super();
  }
}
