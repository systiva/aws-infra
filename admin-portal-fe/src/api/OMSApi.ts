import { apiClient } from './ApiClient';

// Customer interfaces
export interface Customer {
  customerId: string;
  name: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  status: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateCustomerRequest {
  name: string;
  email: string;
  phone?: string;
  address?: any;
  status?: string;
  metadata?: Record<string, any>;
}

// Product interfaces
export interface Product {
  productId: string;
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  price: number;
  currency: string;
  unit?: string;
  status: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  price: number;
  currency?: string;
  unit?: string;
  status?: string;
  metadata?: Record<string, any>;
}

// Order interfaces
export interface OrderItem {
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  orderId: string;
  customerId: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
  shippingAddress?: any;
  billingAddress?: any;
  paymentStatus: string;
  shipmentStatus: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateOrderRequest {
  customerId: string;
  orderDate?: string;
  status?: string;
  totalAmount?: number;
  currency?: string;
  items: OrderItem[];
  shippingAddress?: any;
  billingAddress?: any;
  paymentStatus?: string;
  shipmentStatus?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface OrderStatusHistory {
  status: string;
  timestamp: string;
  updatedBy: string;
}

// Inventory interfaces
export interface Inventory {
  productId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  warehouseLocation?: string;
  lastRestocked?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateInventoryRequest {
  productId: string;
  quantity?: number;
  reservedQuantity?: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  warehouseLocation?: string;
  metadata?: Record<string, any>;
}

export interface StockTransaction {
  transactionId: string;
  quantityChange: number;
  newQuantity: number;
  timestamp: string;
  createdBy: string;
}

// API Response interface
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export class OMSApi {
  private static instance: OMSApi;

  static getInstance(): OMSApi {
    if (!this.instance) {
      this.instance = new OMSApi();
    }
    return this.instance;
  }

  // ===== Customer APIs =====

  async getCustomers(): Promise<Customer[]> {
    const response = await apiClient.request<ApiResponse<Customer[]>>('/oms/customers');
    return response.data;
  }

  async getCustomer(customerId: string): Promise<Customer> {
    const response = await apiClient.request<ApiResponse<Customer>>(`/oms/customers/${customerId}`);
    return response.data;
  }

  async createCustomer(customer: CreateCustomerRequest): Promise<Customer> {
    const response = await apiClient.request<ApiResponse<Customer>>('/oms/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
    return response.data;
  }

  async updateCustomer(customerId: string, customer: Partial<CreateCustomerRequest>): Promise<Customer> {
    const response = await apiClient.request<ApiResponse<Customer>>(`/oms/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(customer),
    });
    return response.data;
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await apiClient.request<void>(`/oms/customers/${customerId}`, {
      method: 'DELETE',
    });
  }

  // ===== Product APIs =====

  async getProducts(): Promise<Product[]> {
    const response = await apiClient.request<ApiResponse<Product[]>>('/oms/products');
    return response.data;
  }

  async getProduct(productId: string): Promise<Product> {
    const response = await apiClient.request<ApiResponse<Product>>(`/oms/products/${productId}`);
    return response.data;
  }

  async createProduct(product: CreateProductRequest): Promise<Product> {
    const response = await apiClient.request<ApiResponse<Product>>('/oms/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
    return response.data;
  }

  async updateProduct(productId: string, product: Partial<CreateProductRequest>): Promise<Product> {
    const response = await apiClient.request<ApiResponse<Product>>(`/oms/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
    return response.data;
  }

  async deleteProduct(productId: string): Promise<void> {
    await apiClient.request<void>(`/oms/products/${productId}`, {
      method: 'DELETE',
    });
  }

  // ===== Order APIs =====

  async getOrders(): Promise<Order[]> {
    const response = await apiClient.request<ApiResponse<Order[]>>('/oms/orders');
    return response.data;
  }

  async getOrder(orderId: string): Promise<Order> {
    const response = await apiClient.request<ApiResponse<Order>>(`/oms/orders/${orderId}`);
    return response.data;
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    const response = await apiClient.request<ApiResponse<Order[]>>(`/oms/orders/customer/${customerId}`);
    return response.data;
  }

  async createOrder(order: CreateOrderRequest): Promise<Order> {
    const response = await apiClient.request<ApiResponse<Order>>('/oms/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
    return response.data;
  }

  async updateOrder(orderId: string, order: Partial<CreateOrderRequest>): Promise<Order> {
    const response = await apiClient.request<ApiResponse<Order>>(`/oms/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    });
    return response.data;
  }

  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const response = await apiClient.request<ApiResponse<Order>>(`/oms/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return response.data;
  }

  async deleteOrder(orderId: string): Promise<void> {
    await apiClient.request<void>(`/oms/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    const response = await apiClient.request<ApiResponse<OrderStatusHistory[]>>(`/oms/orders/${orderId}/history`);
    return response.data;
  }

  // ===== Inventory APIs =====

  async getAllInventory(): Promise<Inventory[]> {
    const response = await apiClient.request<ApiResponse<Inventory[]>>('/oms/inventory');
    return response.data;
  }

  async getInventory(productId: string): Promise<Inventory> {
    const response = await apiClient.request<ApiResponse<Inventory>>(`/oms/inventory/${productId}`);
    return response.data;
  }

  async createInventory(inventory: CreateInventoryRequest): Promise<Inventory> {
    const response = await apiClient.request<ApiResponse<Inventory>>('/oms/inventory', {
      method: 'POST',
      body: JSON.stringify(inventory),
    });
    return response.data;
  }

  async updateInventoryQuantity(productId: string, quantityChange: number): Promise<Inventory> {
    const response = await apiClient.request<ApiResponse<Inventory>>(`/oms/inventory/${productId}/quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ quantityChange }),
    });
    return response.data;
  }

  async getStockTransactions(productId: string): Promise<StockTransaction[]> {
    const response = await apiClient.request<ApiResponse<StockTransaction[]>>(`/oms/inventory/${productId}/transactions`);
    return response.data;
  }

  async reserveInventory(productId: string, quantity: number): Promise<Inventory> {
    const response = await apiClient.request<ApiResponse<Inventory>>(`/oms/inventory/${productId}/reserve`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
    return response.data;
  }

  async releaseInventory(productId: string, quantity: number): Promise<Inventory> {
    const response = await apiClient.request<ApiResponse<Inventory>>(`/oms/inventory/${productId}/release`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
    return response.data;
  }

  async updateInventorySettings(
    productId: string,
    settings: {
      reorderLevel?: number;
      reorderQuantity?: number;
      warehouseLocation?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Inventory> {
    const response = await apiClient.request<ApiResponse<Inventory>>(`/oms/inventory/${productId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return response.data;
  }
}

// Export singleton instance
export const omsApi = OMSApi.getInstance();
