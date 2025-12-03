import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, Alert } from 'antd';
import {
  ShoppingCartOutlined,
  UserOutlined,
  AppstoreOutlined,
  StockOutlined,
  DollarOutlined,
  WarningOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { omsApi, Order, Customer, Product, Inventory } from '../api/OMSApi';
import { useOMSPermissions } from '../hooks/useOMSPermissions';

const OMSDashboard: React.FC = () => {
  const { canWrite } = useOMSPermissions();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [ordersData, customersData, productsData, inventoryData] = await Promise.all([
        omsApi.getOrders().catch(() => []),
        omsApi.getCustomers().catch(() => []),
        omsApi.getProducts().catch(() => []),
        omsApi.getAllInventory().catch(() => []),
      ]);

      setOrders(ordersData);
      setCustomers(customersData);
      setProducts(productsData);
      setInventory(inventoryData);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalRevenue = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, order) => sum + order.totalAmount, 0);

  const pendingOrders = orders.filter(o => o.status === 'PENDING').length;
  const activeCustomers = customers.filter(c => c.status === 'ACTIVE').length;
  const activeProducts = products.filter(p => p.status === 'ACTIVE').length;
  const lowStockItems = inventory.filter(
    i => i.availableQuantity <= i.reorderLevel && i.availableQuantity > 0
  ).length;
  const outOfStockItems = inventory.filter(i => i.availableQuantity === 0).length;

  // Recent orders
  const recentOrders = orders
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .slice(0, 5);

  // Low stock products
  const lowStockProducts = inventory
    .filter(i => i.availableQuantity <= i.reorderLevel)
    .slice(0, 5);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'orange',
      CONFIRMED: 'blue',
      PROCESSING: 'cyan',
      SHIPPED: 'purple',
      DELIVERED: 'green',
      CANCELLED: 'red',
      COMPLETED: 'green',
    };
    return colors[status] || 'default';
  };

  const orderColumns = [
    {
      title: 'Order ID',
      dataIndex: 'orderId',
      key: 'orderId',
      render: (id: string) => id.substring(0, 8) + '...',
    },
    {
      title: 'Customer',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (customerId: string) => {
        const customer = customers.find(c => c.customerId === customerId);
        return customer?.name || customerId.substring(0, 8) + '...';
      },
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number, record: Order) => 
        `${record.currency || 'USD'} ${amount.toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Date',
      dataIndex: 'orderDate',
      key: 'orderDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ];

  const inventoryColumns = [
    {
      title: 'Product',
      dataIndex: 'productId',
      key: 'productId',
      render: (productId: string) => {
        const product = products.find(p => p.productId === productId);
        return product?.name || productId.substring(0, 10) + '...';
      },
    },
    {
      title: 'Available',
      dataIndex: 'availableQuantity',
      key: 'availableQuantity',
      render: (qty: number) => (
        <Tag color={qty === 0 ? 'red' : 'orange'}>{qty}</Tag>
      ),
    },
    {
      title: 'Reorder Level',
      dataIndex: 'reorderLevel',
      key: 'reorderLevel',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: Inventory) => {
        if (record.availableQuantity === 0) {
          return <Tag icon={<WarningOutlined />} color="red">OUT OF STOCK</Tag>;
        }
        return <Tag icon={<WarningOutlined />} color="orange">LOW STOCK</Tag>;
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Order Management System Dashboard</h1>

      {!canWrite && (
        <Alert
          message="Read-Only Mode"
          description="You have view-only access to the Order Management System"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Key Metrics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card hoverable onClick={() => navigate('/oms/orders')}>
            <Statistic
              title="Total Orders"
              value={orders.length}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="orange">{pendingOrders} Pending</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => navigate('/oms/customers')}>
            <Statistic
              title="Customers"
              value={customers.length}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="green">{activeCustomers} Active</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => navigate('/oms/products')}>
            <Statistic
              title="Products"
              value={products.length}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="purple">{activeProducts} Active</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => navigate('/oms/inventory')}>
            <Statistic
              title="Inventory Items"
              value={inventory.length}
              prefix={<StockOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="orange">{lowStockItems} Low Stock</Tag>
              <Tag color="red">{outOfStockItems} Out</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Revenue and Alerts */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={totalRevenue}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="USD"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="Stock Alerts"
              value={lowStockItems + outOfStockItems}
              prefix={<WarningOutlined />}
              valueStyle={{ color: lowStockItems + outOfStockItems > 0 ? '#cf1322' : '#3f8600' }}
            />
            {lowStockItems + outOfStockItems > 0 && (
              <div style={{ marginTop: 8 }}>
                <Tag color="orange">{lowStockItems} Low Stock</Tag>
                <Tag color="red">{outOfStockItems} Out of Stock</Tag>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Orders */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={14}>
          <Card 
            title="Recent Orders" 
            extra={
              <a onClick={() => navigate('/oms/orders')}>View All</a>
            }
          >
            <Table
              columns={orderColumns}
              dataSource={recentOrders}
              rowKey="orderId"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* Low Stock Alert */}
        <Col span={10}>
          <Card 
            title={
              <span>
                <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Stock Alerts
              </span>
            }
            extra={
              <a onClick={() => navigate('/oms/inventory')}>View All</a>
            }
          >
            <Table
              columns={inventoryColumns}
              dataSource={lowStockProducts}
              rowKey="productId"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Row gutter={16}>
        <Col span={6}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => navigate('/oms/orders')}
          >
            <ShoppingCartOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <h3>Create Order</h3>
            <p>Create a new customer order</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => navigate('/oms/customers')}
          >
            <UserOutlined style={{ fontSize: 48, color: '#52c41a' }} />
            <h3>Add Customer</h3>
            <p>Register a new customer</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => navigate('/oms/products')}
          >
            <AppstoreOutlined style={{ fontSize: 48, color: '#722ed1' }} />
            <h3>Add Product</h3>
            <p>Add a new product to catalog</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => navigate('/oms/inventory')}
          >
            <StockOutlined style={{ fontSize: 48, color: '#fa8c16' }} />
            <h3>Manage Stock</h3>
            <p>Update inventory levels</p>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OMSDashboard;
