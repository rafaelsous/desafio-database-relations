import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('Customer does not exists');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (!findProducts.length) {
      throw new AppError('Products does not exists');
    }

    const findProductIds = findProducts.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !findProductIds.includes(product.id),
    );

    if (checkInexistentProducts) {
      throw new AppError(`Products with id ${checkInexistentProducts[0].id}`);
    }

    const productsWithoutQuantityAvailable = products.filter(
      product =>
        findProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (productsWithoutQuantityAvailable) {
      throw new AppError(
        `The quantity ${productsWithoutQuantityAvailable[0].quantity} is not available for ${productsWithoutQuantityAvailable[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: findProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: serializedProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        findProducts.filter(p => p.id === product.product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
