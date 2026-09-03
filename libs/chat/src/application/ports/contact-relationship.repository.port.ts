import type { ContactRelationship } from '../../domain/contact-relationship.entity';

export const CONTACT_RELATIONSHIP_REPOSITORY = Symbol(
  'CONTACT_RELATIONSHIP_REPOSITORY',
);

export interface ContactRelationshipRepository {
  findById(relationshipId: string): Promise<ContactRelationship | null>;
  findCurrentByUserPair(
    firstUserId: string,
    secondUserId: string,
  ): Promise<ContactRelationship | null>;
  save(relationship: ContactRelationship): Promise<ContactRelationship>;
}
