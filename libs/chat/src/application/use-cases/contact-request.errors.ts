export class ContactRelationshipNotFoundError extends Error {
  constructor() {
    super('Contact relationship was not found.');
    this.name = 'ContactRelationshipNotFoundError';
  }
}

export class ContactRequestAlreadyAcceptedError extends Error {
  constructor() {
    super('The Contact request has already been accepted.');
    this.name = 'ContactRequestAlreadyAcceptedError';
  }
}

export class ContactRequestAlreadyRejectedError extends Error {
  constructor() {
    super('The Contact request has already been rejected.');
    this.name = 'ContactRequestAlreadyRejectedError';
  }
}
