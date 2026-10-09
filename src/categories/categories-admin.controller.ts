import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { UserRole } from '../users/enums/user-role.enum';
import { CategoriesViewService } from './categories-view.service';
import { CategoriesService } from './categories.service';
import { CategoryResponseDto } from './dto/category.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Admin - Categories')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(
  HttpStatus.FORBIDDEN,
  'The caller is not an admin, or has been locked.',
)
@Roles(UserRole.Admin)
@Controller('admin/categories')
export class CategoriesAdminController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly view: CategoriesViewService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a category',
    description:
      'The slug comes from the name, with -2, -3... appended when taken. ' +
      'Categories nest two levels deep: the parent must be a root.',
  })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    'A category with this name already exists under the same parent.',
  )
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The parent does not exist or is not a root category.',
  )
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.view.toResponse(
      await this.categoriesService.create(dto.category),
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a category',
    description:
      'Renaming keeps the slug, so existing links still work. Setting ' +
      '`isActive` to false hides the category from menus only: its ' +
      'products stay listed. `parentId: null` moves it to the top level.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The id is not a uuid, or the payload failed validation.',
  )
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No such category.')
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    'A category with this name already exists under the same parent.',
  )
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The parent is the category itself, does not exist, is not a root, ' +
      'or the category has sub-categories of its own.',
  )
  async update(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.view.toResponse(
      await this.categoriesService.update(id, dto.category),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a category',
    description:
      'Only an empty category can go: no products, archived ones included, ' +
      'and no sub-categories.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The id is not a uuid.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No such category.')
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    'The category still has products or sub-categories.',
  )
  remove(@Param('id', ParseUuidPipe) id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
