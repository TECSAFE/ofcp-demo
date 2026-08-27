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

  // Declared before the ':articleNumber' catch-all below, otherwise it would
  // swallow this literal single-segment route.
  @Get('tecsafe-articles')
  tecsafeArticles() {
    return { articles: this.products.listTecsafeArticles() };
  }

  @Get('ean/:ean')
  byEan(@Param('ean') ean: string) {
    const product = this.products.byEan(ean);
    if (!product) throw new NotFoundException(`Unknown EAN ${ean}`);
    return { product };
  }

  @Get(':articleNumber')
  byArticleNumber(@Param('articleNumber') articleNumber: string) {
    const product = this.products.byArticleNumber(articleNumber);
    if (!product)
      throw new NotFoundException(`Unknown article ${articleNumber}`);
    return { product };
  }
}
