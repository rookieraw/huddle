import type { ContactRelationship } from '../../domain/contact-relationship.entity';

export interface ContactRelationshipRepository {
  findCurrentByUserPair(
    firstUserId: string,
    secondUserId: string,
  ): Promise<ContactRelationship | null>;
  save(relationship: ContactRelationship): Promise<ContactRelationship>;
}
