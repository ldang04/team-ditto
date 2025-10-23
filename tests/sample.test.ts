// Sample test file to verify Jest setup
describe('Jest Setup Test', () => {
  it('should run basic Jest tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const promise = Promise.resolve('test');
    const result = await promise;
    expect(result).toBe('test');
  });

  it('should handle arrays and objects', () => {
    const arr = [1, 2, 3];
    const obj = { name: 'test', value: 42 };
    
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
    expect(obj).toHaveProperty('name', 'test');
    expect(obj.value).toBe(42);
  });
});
