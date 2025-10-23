/**
 * __mocks__/bcrypt.ts
 *
 * Jest mock for bcrypt to avoid hashing complexity in tests.
 * Always resolves instantly and returns predictable values.
 */

export const hash = async (value: string) => `hashed-${value}`;
export const compare = async () => true;

export default { hash, compare };
