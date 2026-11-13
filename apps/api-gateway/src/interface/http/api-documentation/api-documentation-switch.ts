export const API_DOCUMENTATION_SWITCH_ENABLE_VALUE = 'true';

export function isApiDocumentationEnabled(value: string | undefined): boolean {
  return value === API_DOCUMENTATION_SWITCH_ENABLE_VALUE;
}
