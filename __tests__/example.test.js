describe('示例测试', () => {
    const arr = [1, 2, 3];

    test('arr 应为数组', async () => {
        expect(Array.isArray(arr)).toBe(true);
    });
    test('arr 所有项均应为数字', async () => {
        expect(arr.every(item => typeof item === 'number')).toBe(true);
    });
});
