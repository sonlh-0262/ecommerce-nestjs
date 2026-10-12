import { Logger } from '@nestjs/common';

import { CreateCategoryBodyDto } from '../../categories/dto/create-category.dto';
import { CategoriesService } from '../../categories/categories.service';
import { Category } from '../../categories/entities/category.entity';
import { SEED_CATEGORIES } from '../../database/seeds/categories.seed-data';
import { SeedCategoriesCommand } from './seed-categories.command';

describe('SeedCategoriesCommand', () => {
  const total = SEED_CATEGORIES.reduce(
    (count, root) => count + 1 + root.children.length,
    0,
  );

  const categoriesMock = { findBySlug: jest.fn(), create: jest.fn() };
  let command: SeedCategoriesCommand;

  const createdInputs = () =>
    (categoriesMock.create.mock.calls as [CreateCategoryBodyDto][]).map(
      ([input]) => input,
    );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    command = new SeedCategoriesCommand(
      categoriesMock as unknown as CategoriesService,
    );
    categoriesMock.findBySlug.mockResolvedValue(null);
    categoriesMock.create.mockImplementation((input: CreateCategoryBodyDto) =>
      Promise.resolve({ id: `id:${input.name}` } as Category),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates every root, then its children under it', async () => {
    await command.run();

    const [root] = SEED_CATEGORIES;

    expect(categoriesMock.create).toHaveBeenCalledTimes(total);
    expect(createdInputs().slice(0, root.children.length + 1)).toEqual([
      { name: root.name, parentId: undefined },
      ...root.children.map((name) => ({ name, parentId: `id:${root.name}` })),
    ]);
  });

  it('skips a category whose slug already exists and nests under it', async () => {
    const [root] = SEED_CATEGORIES;
    categoriesMock.findBySlug.mockImplementation((slug: string) =>
      Promise.resolve(
        slug === 'thoi-trang-nam' ? ({ id: 'existing' } as Category) : null,
      ),
    );

    await command.run();

    expect(createdInputs()).not.toContainEqual(
      expect.objectContaining({ name: root.name }),
    );
    expect(createdInputs()).toContainEqual({
      name: root.children[0],
      parentId: 'existing',
    });
  });

  it('creates nothing on a database that is already seeded', async () => {
    categoriesMock.findBySlug.mockResolvedValue({ id: 'existing' });

    await command.run();

    expect(categoriesMock.create).not.toHaveBeenCalled();
  });
});
