import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Tag,
  Card,
  Alert,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { omsApi, Customer, CreateCustomerRequest } from '../api/OMSApi';
import { useOMSPermissions } from '../hooks/useOMSPermissions';

const CustomerManagement: React.FC = () => {
  const { canWrite } = useOMSPermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await omsApi.getCustomers();
      setCustomers(data);
    } catch (error) {
      message.error('Failed to fetch customers');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCustomer(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.setFieldsValue(customer);
    setModalVisible(true);
  };

  const handleDelete = async (customerId: string) => {
    try {
      await omsApi.deleteCustomer(customerId);
      message.success('Customer deleted successfully');
      fetchCustomers();
    } catch (error) {
      message.error('Failed to delete customer');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingCustomer) {
        await omsApi.updateCustomer(editingCustomer.customerId, values);
        message.success('Customer updated successfully');
      } else {
        await omsApi.createCustomer(values);
        message.success('Customer created successfully');
      }
      
      setModalVisible(false);
      form.resetFields();
      fetchCustomers();
    } catch (error) {
      message.error('Failed to save customer');
      console.error(error);
    }
  };

  const columns = [
    {
      title: 'Customer ID',
      dataIndex: 'customerId',
      key: 'customerId',
      width: 200,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
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
      render: (_: any, record: Customer) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this customer?"
            onConfirm={() => handleDelete(record.customerId)}
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
      title="Customer Management"
      extra={
        canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Add Customer
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
        dataSource={customers}
        rowKey="customerId"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingCustomer ? 'Edit Customer' : 'Create Customer'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter customer name' }]}
          >
            <Input placeholder="Enter customer name" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="Enter email" />
          </Form.Item>

          <Form.Item name="phone" label="Phone">
            <Input placeholder="Enter phone number" />
          </Form.Item>

          <Form.Item name={['address', 'street']} label="Street">
            <Input placeholder="Enter street address" />
          </Form.Item>

          <Form.Item name={['address', 'city']} label="City">
            <Input placeholder="Enter city" />
          </Form.Item>

          <Form.Item name={['address', 'state']} label="State">
            <Input placeholder="Enter state" />
          </Form.Item>

          <Form.Item name={['address', 'zipCode']} label="Zip Code">
            <Input placeholder="Enter zip code" />
          </Form.Item>

          <Form.Item name={['address', 'country']} label="Country">
            <Input placeholder="Enter country" />
          </Form.Item>

          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Input placeholder="Status" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default CustomerManagement;
