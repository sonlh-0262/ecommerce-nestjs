import { paginated } from './paginated';

describe('paginated', () => {
  it('names the list after the resource and the total after the list', () => {
    expect(paginated('products', [{ id: 'a' }], 128)).toEqual({
      products: [{ id: 'a' }],
      productsCount: 128,
    });
  });

  it('produces exactly the two keys of the envelope', () => {
    expect(Object.keys(paginated('orders', [], 0))).toEqual([
      'orders',
      'ordersCount',
    ]);
  });

  it('reports the total rather than the length of the page', () => {
    const { users, usersCount } = paginated('users', [1, 2], 40);

    expect(users).toHaveLength(2);
    expect(usersCount).toBe(40);
  });
});
