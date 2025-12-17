import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Popconfirm,
  message,
  Tag,
  Card,
  Select,
  Drawer,
  Timeline,
  Descriptions,
  Divider,
  Alert,
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  HistoryOutlined 
} from '@ant-design/icons';
import { 
  omsApi,
  Order, 
  CreateOrderRequest, 
  Customer, 
  Product,
  OrderStatusHistory,
  OrderItem 
} from '../api/OMSApi';
import { useOMSPermissions } from '../hooks/useOMSPermissions';

const { TextArea } = Input;
const { Option } = Select;

const OrderManagement: React.FC = () => {
  const { canWrite } = useOMSPermissions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderStatusHistory[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await omsApi.getOrders();
      setOrders(data);
    } catch (error) {
      message.error('Failed to fetch orders');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await omsApi.getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to fetch customers', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await omsApi.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products', error);
    }
  };

  const handleCreate = () => {
    setEditingOrder(null);
    setOrderItems([{ productId: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setOrderItems(order.items);
    form.setFieldsValue({
      customerId: order.customerId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      shipmentStatus: order.shipmentStatus,
      notes: order.notes,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
    });
    setModalVisible(true);
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsVisible(true);
  };

  const handleViewHistory = async (order: Order) => {
    try {
      const history = await omsApi.getOrderStatusHistory(order.orderId);
      setOrderHistory(history);
      setSelectedOrder(order);
      setHistoryVisible(true);
    } catch (error) {
      message.error('Failed to fetch order history');
      console.error(error);
    }
  };

  const handleDelete = async (orderId: string) => {
    try {
      await omsApi.deleteOrder(orderId);
      message.success('Order deleted successfully');
      fetchOrders();
    } catch (error) {
      message.error('Failed to delete order');
      console.error(error);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await omsApi.updateOrderStatus(orderId, status);
      message.success('Order status updated successfully');
      fetchOrders();
    } catch (error) {
      message.error('Failed to update order status');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const totalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
      
      const orderData: CreateOrderRequest = {
        customerId: values.customerId,
        items: orderItems,
        totalAmount,
        status: values.status,
        paymentStatus: values.paymentStatus,
        shipmentStatus: values.shipmentStatus,
        notes: values.notes,
        shippingAddress: values.shippingAddress,
        billingAddress: values.billingAddress,
      };
      
      if (editingOrder) {
        await omsApi.updateOrder(editingOrder.orderId, orderData);
        message.success('Order updated successfully');
      } else {
        await omsApi.createOrder(orderData);
        message.success('Order created successfully');
      }
      
      setModalVisible(false);
      form.resetFields();
      setOrderItems([]);
      fetchOrders();
    } catch (error) {
      message.error('Failed to save order');
      console.error(error);
    }
  };

  const addOrderItem = () => {
    setOrderItems([...orderItems, { productId: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const removeOrderItem = (index: number) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-calculate total price
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].totalPrice = newItems[index].quantity * newItems[index].unitPrice;
    }
    
    // Auto-fill product info
    if (field === 'productId') {
      const product = products.find(p => p.productId === value);
      if (product) {
        newItems[index].unitPrice = product.price;
        newItems[index].totalPrice = newItems[index].quantity * product.price;
        newItems[index].productName = product.name;
      }
    }
    
    setOrderItems(newItems);
  };

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

  const columns = [
    {
      title: 'Order ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 180,
      render: (id: string) => id.substring(0, 8) + '...',
    },
    {
      title: 'Customer',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (customerId: string) => {
        const customer = customers.find(c => c.customerId === customerId);
        return customer?.name || customerId;
      },
    },
    {
      title: 'Order Date',
      dataIndex: 'orderDate',
      key: 'orderDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number, record: Order) => 
        `${record.currency || 'USD'} ${amount.toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Payment',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status: string) => (
        <Tag color={status === 'PAID' ? 'green' : 'orange'}>{status}</Tag>
      ),
    },
    {
      title: 'Shipment',
      dataIndex: 'shipmentStatus',
      key: 'shipmentStatus',
      render: (status: string) => (
        <Tag color={status === 'DELIVERED' ? 'green' : 'blue'}>{status}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      render: (_: any, record: Order) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            Details
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            History
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this order?"
            onConfirm={() => handleDelete(record.orderId)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <Card
      title="Order Management"
      extra={
        canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Create Order
          </Button>
        )
      }
    >
      {!canWrite && (
        <Alert
          message="Read-Only Mode"
          description="You have view-only access to this module"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Table
        columns={canWrite ? columns : columns.filter(col => col.key !== 'actions')}
        dataSource={orders}
        rowKey="orderId"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* Create/Edit Order Modal */}
      <Modal
        title={editingOrder ? 'Edit Order' : 'Create Order'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setOrderItems([]);
        }}
        width={900}
        okText="Save"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="customerId"
            label="Customer"
            rules={[{ required: true, message: 'Please select a customer' }]}
          >
            <Select
              showSearch
              placeholder="Select customer"
              filterOption={(input, option) => {
                const label = option?.label || option?.children;
                return String(label).toLowerCase().includes(input.toLowerCase());
              }}
            >
              {customers.map(customer => (
                <Option key={customer.customerId} value={customer.customerId}>
                  {customer.name} ({customer.email})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider>Order Items</Divider>
          
          {orderItems.map((item, index) => (
            <div key={index} style={{ marginBottom: 16, padding: 16, border: '1px solid #f0f0f0', borderRadius: 4 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space style={{ width: '100%' }}>
                  <Select
                    style={{ width: 300 }}
                    placeholder="Select product"
                    value={item.productId || undefined}
                    onChange={(value) => updateOrderItem(index, 'productId', value)}
                  >
                    {products.map(product => (
                      <Option key={product.productId} value={product.productId}>
                        {product.name} - ${product.price}
                      </Option>
                    ))}
                  </Select>
                  
                  <InputNumber
                    min={1}
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(value) => updateOrderItem(index, 'quantity', value || 1)}
                  />
                  
                  <InputNumber
                    min={0}
                    step={0.01}
                    placeholder="Unit Price"
                    value={item.unitPrice}
                    onChange={(value) => updateOrderItem(index, 'unitPrice', value || 0)}
                    prefix="$"
                  />
                  
                  <InputNumber
                    disabled
                    value={item.totalPrice}
                    prefix="$"
                    precision={2}
                  />
                  
                  <Button danger onClick={() => removeOrderItem(index)}>
                    Remove
                  </Button>
                </Space>
              </Space>
            </div>
          ))}
          
          <Button type="dashed" onClick={addOrderItem} block>
            + Add Item
          </Button>
          
          <Divider />
          
          <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 'bold' }}>
            Total: ${totalAmount.toFixed(2)}
          </div>

          <Divider>Order Details</Divider>

          <Form.Item name="status" label="Status" initialValue="PENDING">
            <Select>
              <Option value="PENDING">PENDING</Option>
              <Option value="CONFIRMED">CONFIRMED</Option>
              <Option value="PROCESSING">PROCESSING</Option>
              <Option value="SHIPPED">SHIPPED</Option>
              <Option value="DELIVERED">DELIVERED</Option>
              <Option value="CANCELLED">CANCELLED</Option>
              <Option value="COMPLETED">COMPLETED</Option>
            </Select>
          </Form.Item>

          <Form.Item name="paymentStatus" label="Payment Status" initialValue="PENDING">
            <Select>
              <Option value="PENDING">PENDING</Option>
              <Option value="PAID">PAID</Option>
              <Option value="FAILED">FAILED</Option>
              <Option value="REFUNDED">REFUNDED</Option>
            </Select>
          </Form.Item>

          <Form.Item name="shipmentStatus" label="Shipment Status" initialValue="NOT_SHIPPED">
            <Select>
              <Option value="NOT_SHIPPED">NOT SHIPPED</Option>
              <Option value="SHIPPED">SHIPPED</Option>
              <Option value="IN_TRANSIT">IN TRANSIT</Option>
              <Option value="DELIVERED">DELIVERED</Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Order notes" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Order Details Drawer */}
      <Drawer
        title="Order Details"
        placement="right"
        width={600}
        open={detailsVisible}
        onClose={() => setDetailsVisible(false)}
      >
        {selectedOrder && (
          <>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Order ID">{selectedOrder.orderId}</Descriptions.Item>
              <Descriptions.Item label="Order Date">
                {new Date(selectedOrder.orderDate).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {customers.find(c => c.customerId === selectedOrder.customerId)?.name || selectedOrder.customerId}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Space>
                  <Tag color={getStatusColor(selectedOrder.status)}>{selectedOrder.status}</Tag>
                  <Select
                    size="small"
                    value={selectedOrder.status}
                    onChange={(value) => handleUpdateStatus(selectedOrder.orderId, value)}
                    style={{ width: 120 }}
                  >
                    <Option value="PENDING">PENDING</Option>
                    <Option value="CONFIRMED">CONFIRMED</Option>
                    <Option value="PROCESSING">PROCESSING</Option>
                    <Option value="SHIPPED">SHIPPED</Option>
                    <Option value="DELIVERED">DELIVERED</Option>
                    <Option value="CANCELLED">CANCELLED</Option>
                  </Select>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status">
                <Tag color={selectedOrder.paymentStatus === 'PAID' ? 'green' : 'orange'}>
                  {selectedOrder.paymentStatus}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Shipment Status">
                <Tag color={selectedOrder.shipmentStatus === 'DELIVERED' ? 'green' : 'blue'}>
                  {selectedOrder.shipmentStatus}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                {selectedOrder.currency} {selectedOrder.totalAmount.toFixed(2)}
              </Descriptions.Item>
            </Descriptions>

            <Divider>Order Items</Divider>
            <Table
              dataSource={selectedOrder.items}
              rowKey={(item, index) => `${item.productId}-${index}`}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Product',
                  dataIndex: 'productName',
                  key: 'productName',
                  render: (name, record) => name || record.productId,
                },
                {
                  title: 'Quantity',
                  dataIndex: 'quantity',
                  key: 'quantity',
                },
                {
                  title: 'Unit Price',
                  dataIndex: 'unitPrice',
                  key: 'unitPrice',
                  render: (price) => `$${price.toFixed(2)}`,
                },
                {
                  title: 'Total',
                  dataIndex: 'totalPrice',
                  key: 'totalPrice',
                  render: (price) => `$${price.toFixed(2)}`,
                },
              ]}
            />

            {selectedOrder.notes && (
              <>
                <Divider>Notes</Divider>
                <p>{selectedOrder.notes}</p>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Order History Drawer */}
      <Drawer
        title="Order Status History"
        placement="right"
        width={500}
        open={historyVisible}
        onClose={() => setHistoryVisible(false)}
      >
        {selectedOrder && (
          <>
            <h3>Order: {selectedOrder.orderId.substring(0, 8)}...</h3>
            <Divider />
            <Timeline>
              {orderHistory.map((history, index) => (
                <Timeline.Item key={index} color={getStatusColor(history.status)}>
                  <p><strong>{history.status}</strong></p>
                  <p>{new Date(history.timestamp).toLocaleString()}</p>
                  <p style={{ color: '#888' }}>By: {history.updatedBy}</p>
                </Timeline.Item>
              ))}
            </Timeline>
          </>
        )}
      </Drawer>
    </Card>
  );
};

export default OrderManagement;
