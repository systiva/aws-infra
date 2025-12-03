import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  message,
  Tag,
  Card,
  Drawer,
  Timeline,
  Descriptions,
  Divider,
  Row,
  Col,
  Statistic,
  Select,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  SettingOutlined,
  StockOutlined,
} from '@ant-design/icons';
import {
  omsApi,
  Inventory,
  CreateInventoryRequest,
  Product,
  StockTransaction,
} from '../api/OMSApi';
import { useOMSPermissions } from '../hooks/useOMSPermissions';

const { Option } = Select;

const InventoryManagement: React.FC = () => {
  const { canWrite } = useOMSPermissions();
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [transactionsVisible, setTransactionsVisible] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [form] = Form.useForm();
  const [adjustForm] = Form.useForm();
  const [settingsForm] = Form.useForm();

  useEffect(() => {
    fetchInventory();
    fetchProducts();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await omsApi.getAllInventory();
      setInventory(data);
    } catch (error) {
      message.error('Failed to fetch inventory');
      console.error(error);
    } finally {
      setLoading(false);
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
    form.resetFields();
    setCreateModalVisible(true);
  };

  const handleAdjustStock = (item: Inventory) => {
    setSelectedInventory(item);
    adjustForm.resetFields();
    setAdjustModalVisible(true);
  };

  const handleSettings = (item: Inventory) => {
    setSelectedInventory(item);
    settingsForm.setFieldsValue({
      reorderLevel: item.reorderLevel,
      reorderQuantity: item.reorderQuantity,
      warehouseLocation: item.warehouseLocation,
    });
    setSettingsModalVisible(true);
  };

  const handleViewTransactions = async (item: Inventory) => {
    try {
      const data = await omsApi.getStockTransactions(item.productId);
      setTransactions(data);
      setSelectedInventory(item);
      setTransactionsVisible(true);
    } catch (error) {
      message.error('Failed to fetch transactions');
      console.error(error);
    }
  };

  const handleReserve = async (productId: string) => {
    Modal.confirm({
      title: 'Reserve Inventory',
      content: (
        <Form>
          <Form.Item label="Quantity to Reserve">
            <InputNumber min={1} id="reserve-quantity" />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const quantity = (document.getElementById('reserve-quantity') as HTMLInputElement)?.value;
        if (quantity) {
          try {
            await omsApi.reserveInventory(productId, parseInt(quantity));
            message.success('Inventory reserved successfully');
            fetchInventory();
          } catch (error) {
            message.error('Failed to reserve inventory');
            console.error(error);
          }
        }
      },
    });
  };

  const handleRelease = async (productId: string) => {
    Modal.confirm({
      title: 'Release Reserved Inventory',
      content: (
        <Form>
          <Form.Item label="Quantity to Release">
            <InputNumber min={1} id="release-quantity" />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const quantity = (document.getElementById('release-quantity') as HTMLInputElement)?.value;
        if (quantity) {
          try {
            await omsApi.releaseInventory(productId, parseInt(quantity));
            message.success('Inventory released successfully');
            fetchInventory();
          } catch (error) {
            message.error('Failed to release inventory');
            console.error(error);
          }
        }
      },
    });
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields();
      await omsApi.createInventory(values);
      message.success('Inventory created successfully');
      setCreateModalVisible(false);
      form.resetFields();
      fetchInventory();
    } catch (error) {
      message.error('Failed to create inventory');
      console.error(error);
    }
  };

  const handleAdjustSubmit = async () => {
    try {
      const values = await adjustForm.validateFields();
      if (selectedInventory) {
        await omsApi.updateInventoryQuantity(
          selectedInventory.productId,
          values.quantityChange
        );
        message.success('Stock adjusted successfully');
        setAdjustModalVisible(false);
        adjustForm.resetFields();
        fetchInventory();
      }
    } catch (error) {
      message.error('Failed to adjust stock');
      console.error(error);
    }
  };

  const handleSettingsSubmit = async () => {
    try {
      const values = await settingsForm.validateFields();
      if (selectedInventory) {
        await omsApi.updateInventorySettings(selectedInventory.productId, values);
        message.success('Settings updated successfully');
        setSettingsModalVisible(false);
        fetchInventory();
      }
    } catch (error) {
      message.error('Failed to update settings');
      console.error(error);
    }
  };

  const getStockStatus = (item: Inventory) => {
    if (item.availableQuantity === 0) {
      return { status: 'OUT OF STOCK', color: 'red', icon: <WarningOutlined /> };
    } else if (item.availableQuantity <= item.reorderLevel) {
      return { status: 'LOW STOCK', color: 'orange', icon: <WarningOutlined /> };
    }
    return { status: 'IN STOCK', color: 'green', icon: <CheckCircleOutlined /> };
  };

  const columns = [
    {
      title: 'Product',
      dataIndex: 'productId',
      key: 'productId',
      render: (productId: string) => {
        const product = products.find(p => p.productId === productId);
        return product ? `${product.name} (${product.sku || productId})` : productId;
      },
    },
    {
      title: 'Total Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number) => <strong>{quantity}</strong>,
    },
    {
      title: 'Reserved',
      dataIndex: 'reservedQuantity',
      key: 'reservedQuantity',
      render: (reserved: number) => (
        <Tag color="blue">{reserved}</Tag>
      ),
    },
    {
      title: 'Available',
      dataIndex: 'availableQuantity',
      key: 'availableQuantity',
      render: (available: number) => (
        <Tag color={available > 0 ? 'green' : 'red'}>{available}</Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: Inventory) => {
        const { status, color, icon } = getStockStatus(record);
        return (
          <Tag icon={icon} color={color}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Reorder Level',
      dataIndex: 'reorderLevel',
      key: 'reorderLevel',
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouseLocation',
      key: 'warehouseLocation',
      render: (location: string) => location || '-',
    },
    {
      title: 'Last Restocked',
      dataIndex: 'lastRestocked',
      key: 'lastRestocked',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 300,
      render: (_: any, record: Inventory) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<StockOutlined />}
            onClick={() => handleAdjustStock(record)}
          >
            Adjust
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleReserve(record.productId)}
          >
            Reserve
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleRelease(record.productId)}
          >
            Release
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewTransactions(record)}
          >
            History
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleSettings(record)}
          >
            Settings
          </Button>
        </Space>
      ),
    },
  ];

  const totalStock = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const totalAvailable = inventory.reduce((sum, item) => sum + item.availableQuantity, 0);
  const totalReserved = inventory.reduce((sum, item) => sum + item.reservedQuantity, 0);
  const lowStockCount = inventory.filter(item => 
    item.availableQuantity <= item.reorderLevel && item.availableQuantity > 0
  ).length;
  const outOfStockCount = inventory.filter(item => item.availableQuantity === 0).length;

  return (
    <Card
      title="Inventory Management"
      extra={
        canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Initialize Inventory
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
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Statistic title="Total Products" value={inventory.length} />
        </Col>
        <Col span={4}>
          <Statistic title="Total Stock" value={totalStock} />
        </Col>
        <Col span={4}>
          <Statistic title="Available" value={totalAvailable} valueStyle={{ color: '#3f8600' }} />
        </Col>
        <Col span={4}>
          <Statistic title="Reserved" value={totalReserved} valueStyle={{ color: '#1890ff' }} />
        </Col>
        <Col span={4}>
          <Statistic 
            title="Low Stock" 
            value={lowStockCount} 
            valueStyle={{ color: '#faad14' }}
            prefix={<WarningOutlined />}
          />
        </Col>
        <Col span={4}>
          <Statistic 
            title="Out of Stock" 
            value={outOfStockCount} 
            valueStyle={{ color: '#cf1322' }}
            prefix={<WarningOutlined />}
          />
        </Col>
      </Row>

      <Table
        columns={canWrite ? columns : columns.filter(col => col.key !== 'actions')}
        dataSource={inventory}
        rowKey="productId"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* Create Inventory Modal */}
      <Modal
        title="Initialize Inventory"
        open={createModalVisible}
        onOk={handleCreateSubmit}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="productId"
            label="Product"
            rules={[{ required: true, message: 'Please select a product' }]}
          >
            <Select
              showSearch
              placeholder="Select product"
              optionFilterProp="children"
            >
              {products.map(product => (
                <Option key={product.productId} value={product.productId}>
                  {product.name} ({product.sku || product.productId})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Initial Quantity"
            initialValue={0}
            rules={[{ required: true, message: 'Please enter quantity' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="reorderLevel" label="Reorder Level" initialValue={10}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="reorderQuantity" label="Reorder Quantity" initialValue={50}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="warehouseLocation" label="Warehouse Location">
            <Input placeholder="Enter warehouse location" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        title="Adjust Stock"
        open={adjustModalVisible}
        onOk={handleAdjustSubmit}
        onCancel={() => {
          setAdjustModalVisible(false);
          adjustForm.resetFields();
        }}
      >
        {selectedInventory && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Product">
                {products.find(p => p.productId === selectedInventory.productId)?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Current Stock">{selectedInventory.quantity}</Descriptions.Item>
              <Descriptions.Item label="Available">{selectedInventory.availableQuantity}</Descriptions.Item>
              <Descriptions.Item label="Reserved">{selectedInventory.reservedQuantity}</Descriptions.Item>
            </Descriptions>

            <Form form={adjustForm} layout="vertical">
              <Form.Item
                name="quantityChange"
                label="Quantity Change"
                help="Use positive numbers to add stock, negative to reduce"
                rules={[{ required: true, message: 'Please enter quantity change' }]}
              >
                <InputNumber 
                  style={{ width: '100%' }} 
                  placeholder="Enter quantity (e.g., 100 or -50)"
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Settings Modal */}
      <Modal
        title="Inventory Settings"
        open={settingsModalVisible}
        onOk={handleSettingsSubmit}
        onCancel={() => setSettingsModalVisible(false)}
      >
        <Form form={settingsForm} layout="vertical">
          <Form.Item name="reorderLevel" label="Reorder Level">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="reorderQuantity" label="Reorder Quantity">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="warehouseLocation" label="Warehouse Location">
            <Input placeholder="Enter warehouse location" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Transaction History Drawer */}
      <Drawer
        title="Stock Transaction History"
        placement="right"
        width={500}
        open={transactionsVisible}
        onClose={() => setTransactionsVisible(false)}
      >
        {selectedInventory && (
          <>
            <h3>
              {products.find(p => p.productId === selectedInventory.productId)?.name}
            </h3>
            <Divider />
            <Timeline>
              {transactions.map((transaction, index) => (
                <Timeline.Item 
                  key={index} 
                  color={transaction.quantityChange > 0 ? 'green' : 'red'}
                >
                  <p>
                    <strong>
                      {transaction.quantityChange > 0 ? '+' : ''}{transaction.quantityChange} units
                    </strong>
                  </p>
                  <p>New Stock: {transaction.newQuantity}</p>
                  <p>{new Date(transaction.timestamp).toLocaleString()}</p>
                  <p style={{ color: '#888' }}>By: {transaction.createdBy}</p>
                </Timeline.Item>
              ))}
            </Timeline>
          </>
        )}
      </Drawer>
    </Card>
  );
};

export default InventoryManagement;
