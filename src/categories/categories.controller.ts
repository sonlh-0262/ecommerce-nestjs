import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CategoriesViewService } from './categories-view.service';
import { CategoriesQueryDto } from './dto/categories-query.dto';
import {
  CategoriesResponseDto,
  CategoryDetailResponseDto,
} from './dto/category.dto';

@ApiTags('Categories')
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly view: CategoriesViewService) {}

  @Get()
  @ApiOperation({
    summary: 'List categories',
    description:
      'Sorted by name. Served from a cache for a few minutes; any admin ' +
      'change clears it.',
  })
  @ApiOkResponse({ type: CategoriesResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  list(@Query() query: CategoriesQueryDto): Promise<CategoriesResponseDto> {
    return this.view.list(query);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get a category',
    description: 'With its parent and its direct sub-categories.',
  })
  @ApiParam({ name: 'slug', example: 'thoi-trang-nam' })
  @ApiOkResponse({ type: CategoryDetailResponseDto })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No category has this slug.')
  findOne(@Param('slug') slug: string): Promise<CategoryDetailResponseDto> {
    return this.view.findBySlug(slug);
  }
}
