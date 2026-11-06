import * as chatPackage from './index';

describe('@huddle/chat acceptance package boundary', () => {
  it('exports the acceptance Application capability without exposing its implementation', () => {
    expect(chatPackage).toEqual(
      expect.objectContaining({
        AcceptContactRequestUseCase: expect.any(Function),
        ContactRelationshipNotFoundError: expect.any(Function),
        ContactRequestAcceptanceNotAuthorizedError: expect.any(Function),
        ContactRequestAlreadyAcceptedError: expect.any(Function),
        ContactRequestAcceptanceUnavailableError: expect.any(Function),
      }),
    );
    expect(chatPackage).not.toHaveProperty('ContactRelationship');
    expect(chatPackage).not.toHaveProperty(
      'PrismaContactRelationshipRepository',
    );
    expect(chatPackage).not.toHaveProperty('PrismaClient');
  });

  it('exports the rejection Application capability without exposing its implementation', () => {
    expect(chatPackage).toEqual(
      expect.objectContaining({
        RejectContactRequestUseCase: expect.any(Function),
        ContactRequestRejectionNotAuthorizedError: expect.any(Function),
        ContactRequestAlreadyRejectedError: expect.any(Function),
        ContactRequestRejectionUnavailableError: expect.any(Function),
      }),
    );
    expect(chatPackage).not.toHaveProperty('ContactRelationship');
    expect(chatPackage).not.toHaveProperty(
      'PrismaContactRelationshipRepository',
    );
    expect(chatPackage).not.toHaveProperty('PrismaClient');
  });

  it('exports the listing capability shared by the incoming and outgoing listings without exposing its helpers', () => {
    expect(chatPackage).toEqual(
      expect.objectContaining({
        InvalidContactRequestListLimitError: expect.any(Function),
        InvalidContactRequestListCursorError: expect.any(Function),
        REQUESTER_PROFILE_DIRECTORY: expect.any(Symbol),
      }),
    );
    expect(chatPackage).not.toHaveProperty(
      'CONTACT_REQUEST_LIST_DEFAULT_LIMIT',
    );
    expect(chatPackage).not.toHaveProperty('CONTACT_REQUEST_LIST_MAX_LIMIT');
    expect(chatPackage).not.toHaveProperty('resolveLimit');
    expect(chatPackage).not.toHaveProperty('resolveAfterId');
    expect(chatPackage).not.toHaveProperty('encodeCursor');
  });

  it('exports the incoming listing Application capability without exposing its implementation', () => {
    expect(chatPackage).toEqual(
      expect.objectContaining({
        ListIncomingContactRequestsUseCase: expect.any(Function),
        IncomingContactRequestListingUnavailableError: expect.any(Function),
      }),
    );
    expect(chatPackage).not.toHaveProperty('ContactRelationship');
    expect(chatPackage).not.toHaveProperty(
      'PrismaContactRelationshipRepository',
    );
    expect(chatPackage).not.toHaveProperty('PrismaClient');
  });

  it('exports the outgoing listing Application capability without exposing its implementation', () => {
    expect(chatPackage).toEqual(
      expect.objectContaining({
        ListOutgoingContactRequestsUseCase: expect.any(Function),
        OutgoingContactRequestListingUnavailableError: expect.any(Function),
      }),
    );
    expect(chatPackage).not.toHaveProperty('ContactRelationship');
    expect(chatPackage).not.toHaveProperty(
      'PrismaContactRelationshipRepository',
    );
    expect(chatPackage).not.toHaveProperty('PrismaClient');
  });
});
