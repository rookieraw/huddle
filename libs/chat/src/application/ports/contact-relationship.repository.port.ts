import type { ContactRelationship } from '../../domain/contact-relationship.entity';

export const CONTACT_RELATIONSHIP_REPOSITORY = Symbol(
  'CONTACT_RELATIONSHIP_REPOSITORY',
);

export type FindPendingByRecipientQuery = {
  recipientId: string;
  take: number;
  afterRelationshipId?: string;
};

export type FindPendingByRequesterQuery = {
  requesterId: string;
  take: number;
};

export interface ContactRelationshipRepository {
  findById(relationshipId: string): Promise<ContactRelationship | null>;
  findCurrentByUserPair(
    firstUserId: string,
    secondUserId: string,
  ): Promise<ContactRelationship | null>;
  findPendingByRecipient(
    query: FindPendingByRecipientQuery,
  ): Promise<ContactRelationship[]>;
  findPendingByRequester(
    query: FindPendingByRequesterQuery,
  ): Promise<ContactRelationship[]>;
  save(relationship: ContactRelationship): Promise<ContactRelationship>;
  transitionFromPending(relationship: ContactRelationship): Promise<boolean>;
}
