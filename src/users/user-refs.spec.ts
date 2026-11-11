import { In, Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { loadUserRefs } from './user-refs';

describe('loadUserRefs', () => {
  const usersRepository = { find: jest.fn() };
  const users = usersRepository as unknown as Repository<User>;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads each account once, deleted ones included', async () => {
    const an = {
      id: 'u1',
      email: 'an@example.com',
      username: 'an',
      fullName: null,
    };
    usersRepository.find.mockResolvedValue([an]);

    const refs = await loadUserRefs(users, ['u1', 'u1']);

    expect(usersRepository.find).toHaveBeenCalledWith({
      where: { id: In(['u1']) },
      select: { id: true, email: true, username: true, fullName: true },
      withDeleted: true,
    });
    expect(refs.get('u1')).toBe(an);
  });

  it('asks nothing for no id', async () => {
    await expect(loadUserRefs(users, [])).resolves.toEqual(new Map());
    expect(usersRepository.find).not.toHaveBeenCalled();
  });
});
