import * as chatPackage from '@huddle/chat';
import type { ContactTargetDirectory } from '@huddle/chat';

describe('@huddle/chat public package boundary', () => {
  it('resolves the package while consuming ContactTargetDirectory', () => {
    const directory: ContactTargetDirectory = {
      targetUserExists: jest.fn(() => Promise.resolve(true)),
    };

    expect(chatPackage).toBeDefined();
    expect(directory).toBeDefined();
  });
});
