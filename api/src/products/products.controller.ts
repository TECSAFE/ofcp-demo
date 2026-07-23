import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query('includeDummyItems') includeDummyItems?: string) {
    return {
      products: this.products.list({
        includeDummyItems: includeDummyItems === 'true',
      }),
    };
  }

  @Get(':articleNumber')
  byArticleNumber(@Param('articleNumber') articleNumber: string) {
    const product = this.products.byArticleNumber(articleNumber);
    if (!product)
      throw new NotFoundException(`Unknown article ${articleNumber}`);
    return { product };
  }
}
