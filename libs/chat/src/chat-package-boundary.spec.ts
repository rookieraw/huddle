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

  it('exports the incoming listing Application capability without exposing its implementation', () => {
    expect(chatPackage).toEqual(
      expect.objectContaining({
        ListIncomingContactRequestsUseCase: expect.any(Function),
        ContactRequestListingUnavailableError: expect.any(Function),
        InvalidIncomingListLimitError: expect.any(Function),
        InvalidIncomingListCursorError: expect.any(Function),
        REQUESTER_PROFILE_DIRECTORY: expect.any(Symbol),
      }),
    );
    expect(chatPackage).not.toHaveProperty('ContactRelationship');
    expect(chatPackage).not.toHaveProperty(
      'PrismaContactRelationshipRepository',
    );
    expect(chatPackage).not.toHaveProperty('PrismaClient');
    expect(chatPackage).not.toHaveProperty(
      'INCOMING_CONTACT_REQUEST_DEFAULT_LIMIT',
    );
    expect(chatPackage).not.toHaveProperty(
      'INCOMING_CONTACT_REQUEST_MAX_LIMIT',
    );
  });
});
