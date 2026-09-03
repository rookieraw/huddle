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
});
