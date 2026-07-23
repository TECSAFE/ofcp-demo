import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { ShopSession } from '../session/session.decorator';
import type { Session } from '../session/session.types';
import { AddCartItemDto } from './cart.dto';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly products: ProductsService,
  ) {}

  @Get()
  getCart(@ShopSession() session: Session) {
    return this.cart.getCart(session.sid);
  }

  @Post('items')
  async addItem(@ShopSession() session: Session, @Body() dto: AddCartItemDto) {
    if (!this.products.byArticleNumber(dto.articleNumber)) {
      throw new NotFoundException(`Unknown article ${dto.articleNumber}`);
    }
    await this.cart.addItem(session.sid, {
      articleNumber: dto.articleNumber,
      quantity: dto.quantity,
      ...(dto.configurationId ? { configurationId: dto.configurationId } : {}),
    });
    return { ok: true };
  }

  @Delete()
  async clear(@ShopSession() session: Session) {
    await this.cart.clear(session.sid);
    return { ok: true };
  }
}
