/**
 * Fixed validation detail message of each request field a Contacts operation
 * can report, used only to document examples.
 */
export const contactValidationDetailMessages: Record<string, string> = {
  targetUserId: 'targetUserId must be a non-empty string.',
  limit: 'limit must be an integer from 1 to 50.',
  cursor: 'cursor must be a valid cursor.',
};

/**
 * Fixed public messages of the Contacts error codes, used only to document
 * examples. The exception filter owns the real responses.
 */
export const contactErrorMessages: Record<string, string> = {
  AUTHENTICATION_REQUIRED: 'Authentication is required.',
  VALIDATION_FAILED: 'Request validation failed.',
  SELF_CONTACT_REQUEST: 'A Contact request cannot target the requester.',
  CONTACT_TARGET_NOT_FOUND: 'Contact target was not found.',
  CONTACT_TARGET_LOOKUP_UNAVAILABLE:
    'Contact target validation is temporarily unavailable.',
  CONTACT_REQUEST_UNAVAILABLE:
    'Contact request service is temporarily unavailable.',
  CONTACT_REQUEST_NOT_FOUND: 'Contact request was not found.',
  CONTACT_REQUEST_ALREADY_ACCEPTED:
    'Contact request has already been accepted.',
  CONTACT_REQUEST_ALREADY_REJECTED:
    'Contact request has already been rejected.',
  CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE:
    'Contact request acceptance is temporarily unavailable.',
  CONTACT_REQUEST_REJECTION_UNAVAILABLE:
    'Contact request rejection is temporarily unavailable.',
  CONTACT_REQUEST_LISTING_UNAVAILABLE:
    'Incoming Contact requests are temporarily unavailable.',
  OUTGOING_CONTACT_REQUEST_LISTING_UNAVAILABLE:
    'Outgoing Contact requests are temporarily unavailable.',
  ACCEPTED_CONTACT_LISTING_UNAVAILABLE:
    'Accepted Contacts are temporarily unavailable.',
  CONTACT_NOT_FOUND: 'Contact was not found.',
  CONTACT_REMOVAL_UNAVAILABLE: 'Contact removal is temporarily unavailable.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
};
