import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RatingField } from './review-fields.decorator';

export class ReviewsQueryDto extends PaginationQueryDto {
  @RatingField({
    optional: true,
    description: 'Only the reviews with exactly this many stars.',
  })
  rating?: number;
}
