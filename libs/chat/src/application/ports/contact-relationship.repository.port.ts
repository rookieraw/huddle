import type { ContactRelationship } from '../../domain/contact-relationship.entity';

export const CONTACT_RELATIONSHIP_REPOSITORY = Symbol(
  'CONTACT_RELATIONSHIP_REPOSITORY',
);

export interface ContactRelationshipRepository {
  findCurrentByUserPair(
    firstUserId: string,
    secondUserId: string,
  ): Promise<ContactRelationship | null>;
  save(relationship: ContactRelationship): Promise<ContactRelationship>;
}
