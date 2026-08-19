import type { ContactRelationship } from '../../domain/contact-relationship.entity';

export interface ContactRelationshipRepository {
  save(relationship: ContactRelationship): Promise<void>;
}
