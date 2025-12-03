import axios, { AxiosInstance } from 'axios';

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

// API Response interfaces
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

class OMSApiClient {
  private client: AxiosInstance;
  private getToken: (() => string | null) | null = null;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL: `${baseURL}/api/v1/oms`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
        // Use token provider if available, otherwise fallback to localStorage
        const token = this.getToken ? this.getToken() : localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Set token provider function (called by AuthContext)
   */
  setTokenProvider(getToken: () => string | null) {
    this.getToken = getToken;
  }

  // ===== Customer APIs =====

  async getCustomers(): Promise<Customer[]> {
    const response = await this.client.get<ApiResponse<Customer[]>>('/customers');
    return response.data.data;
  }

  async getCustomer(customerId: string): Promise<Customer> {
    const response = await this.client.get<ApiResponse<Customer>>(`/customers/${customerId}`);
    return response.data.data;
  }

  async createCustomer(customer: CreateCustomerRequest): Promise<Customer> {
    const response = await this.client.post<ApiResponse<Customer>>('/customers', customer);
    return response.data.data;
  }

  async updateCustomer(customerId: string, customer: Partial<CreateCustomerRequest>): Promise<Customer> {
    const response = await this.client.put<ApiResponse<Customer>>(`/customers/${customerId}`, customer);
    return response.data.data;
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await this.client.delete(`/customers/${customerId}`);
  }

  // ===== Product APIs =====

  async getProducts(): Promise<Product[]> {
    const response = await this.client.get<ApiResponse<Product[]>>('/products');
    return response.data.data;
  }

  async getProduct(productId: string): Promise<Product> {
    const response = await this.client.get<ApiResponse<Product>>(`/products/${productId}`);
    return response.data.data;
  }

  async createProduct(product: CreateProductRequest): Promise<Product> {
    const response = await this.client.post<ApiResponse<Product>>('/products', product);
    return response.data.data;
  }

  async updateProduct(productId: string, product: Partial<CreateProductRequest>): Promise<Product> {
    const response = await this.client.put<ApiResponse<Product>>(`/products/${productId}`, product);
    return response.data.data;
  }

  async deleteProduct(productId: string): Promise<void> {
    await this.client.delete(`/products/${productId}`);
  }

  // ===== Order APIs =====

  async getOrders(): Promise<Order[]> {
    const response = await this.client.get<ApiResponse<Order[]>>('/orders');
    return response.data.data;
  }

  async getOrder(orderId: string): Promise<Order> {
    const response = await this.client.get<ApiResponse<Order>>(`/orders/${orderId}`);
    return response.data.data;
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    const response = await this.client.get<ApiResponse<Order[]>>(`/orders/customer/${customerId}`);
    return response.data.data;
  }

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    const response = await this.client.get<ApiResponse<OrderStatusHistory[]>>(`/orders/${orderId}/status-history`);
    return response.data.data;
  }

  async createOrder(order: CreateOrderRequest): Promise<Order> {
    const response = await this.client.post<ApiResponse<Order>>('/orders', order);
    return response.data.data;
  }

  async updateOrder(orderId: string, order: Partial<CreateOrderRequest>): Promise<Order> {
    const response = await this.client.put<ApiResponse<Order>>(`/orders/${orderId}`, order);
    return response.data.data;
  }

  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const response = await this.client.patch<ApiResponse<Order>>(`/orders/${orderId}/status`, { status });
    return response.data.data;
  }

  async deleteOrder(orderId: string): Promise<void> {
    await this.client.delete(`/orders/${orderId}`);
  }

  // ===== Inventory APIs =====

  async getAllInventory(): Promise<Inventory[]> {
    const response = await this.client.get<ApiResponse<Inventory[]>>('/inventory');
    return response.data.data;
  }

  async getInventory(productId: string): Promise<Inventory> {
    const response = await this.client.get<ApiResponse<Inventory>>(`/inventory/${productId}`);
    return response.data.data;
  }

  async getStockTransactions(productId: string): Promise<StockTransaction[]> {
    const response = await this.client.get<ApiResponse<StockTransaction[]>>(`/inventory/${productId}/transactions`);
    return response.data.data;
  }

  async createInventory(inventory: CreateInventoryRequest): Promise<Inventory> {
    const response = await this.client.post<ApiResponse<Inventory>>('/inventory', inventory);
    return response.data.data;
  }

  async updateInventoryQuantity(productId: string, quantityChange: number): Promise<Inventory> {
    const response = await this.client.patch<ApiResponse<Inventory>>(
      `/inventory/${productId}/quantity`,
      { quantityChange }
    );
    return response.data.data;
  }

  async reserveInventory(productId: string, quantity: number): Promise<Inventory> {
    const response = await this.client.patch<ApiResponse<Inventory>>(
      `/inventory/${productId}/reserve`,
      { quantity }
    );
    return response.data.data;
  }

  async releaseInventory(productId: string, quantity: number): Promise<Inventory> {
    const response = await this.client.patch<ApiResponse<Inventory>>(
      `/inventory/${productId}/release`,
      { quantity }
    );
    return response.data.data;
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
    const response = await this.client.put<ApiResponse<Inventory>>(
      `/inventory/${productId}/settings`,
      settings
    );
    return response.data.data;
  }
}

// Export singleton instance
export const omsApiClient = new OMSApiClient(
  process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8080'
);

export default OMSApiClient;
