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
  Alert,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { omsApi, Product, CreateProductRequest } from '../api/OMSApi';
import { useOMSPermissions } from '../hooks/useOMSPermissions';

const { TextArea } = Input;
const { Option } = Select;

const ProductManagement: React.FC = () => {
  const { canWrite } = useOMSPermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await omsApi.getProducts();
      setProducts(data);
    } catch (error) {
      message.error('Failed to fetch products');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingProduct(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.setFieldsValue(product);
    setModalVisible(true);
  };

  const handleDelete = async (productId: string) => {
    try {
      await omsApi.deleteProduct(productId);
      message.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      message.error('Failed to delete product');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingProduct) {
        await omsApi.updateProduct(editingProduct.productId, values);
        message.success('Product updated successfully');
      } else {
        await omsApi.createProduct(values);
        message.success('Product created successfully');
      }
      
      setModalVisible(false);
      form.resetFields();
      fetchProducts();
    } catch (error) {
      message.error('Failed to save product');
      console.error(error);
    }
  };

  const columns = [
    {
      title: 'Product ID',
      dataIndex: 'productId',
      key: 'productId',
      width: 150,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price: number, record: Product) => `${record.currency || 'USD'} ${price.toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>{status}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: Product) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this product?"
            onConfirm={() => handleDelete(record.productId)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Product Management"
      extra={
        canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Add Product
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
        dataSource={products}
        rowKey="productId"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingProduct ? 'Edit Product' : 'Create Product'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Product Name"
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input placeholder="Enter product name" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Enter product description" />
          </Form.Item>

          <Form.Item name="sku" label="SKU">
            <Input placeholder="Enter SKU" />
          </Form.Item>

          <Form.Item name="category" label="Category">
            <Input placeholder="Enter category" />
          </Form.Item>

          <Form.Item
            name="price"
            label="Price"
            rules={[{ required: true, message: 'Please enter price' }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
              placeholder="Enter price"
            />
          </Form.Item>

          <Form.Item name="currency" label="Currency" initialValue="USD">
            <Select>
              <Option value="USD">USD</Option>
              <Option value="EUR">EUR</Option>
              <Option value="GBP">GBP</Option>
              <Option value="INR">INR</Option>
            </Select>
          </Form.Item>

          <Form.Item name="unit" label="Unit">
            <Input placeholder="Enter unit (e.g., pcs, kg, ltr)" />
          </Form.Item>

          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">ACTIVE</Option>
              <Option value="INACTIVE">INACTIVE</Option>
              <Option value="DISCONTINUED">DISCONTINUED</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ProductManagement;
