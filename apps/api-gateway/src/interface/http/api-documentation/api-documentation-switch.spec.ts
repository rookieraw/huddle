import { isApiDocumentationEnabled } from './api-documentation-switch';

describe('isApiDocumentationEnabled', () => {
  it('is enabled only by the exact value "true"', () => {
    expect(isApiDocumentationEnabled('true')).toBe(true);
  });

  it.each([
    undefined,
    '',
    'false',
    'TRUE',
    'True',
    '1',
    'yes',
    ' true',
    'true ',
    'true\n',
  ])('is disabled for %p', (value) => {
    expect(isApiDocumentationEnabled(value)).toBe(false);
  });
});
