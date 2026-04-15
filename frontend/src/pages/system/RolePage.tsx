import React, { useState, useEffect, useCallback } from 'react';
import { Button, Space, Modal, Tree, Table, message } from 'antd';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { getRoles, createRole, updateRolePermissions, getPermissionsTree } from '../../api/system';
import { formatDateTime } from '../../utils/formatter';
import type { Role, PermissionNode } from '../../types/user';

const formFields: FormFieldConfig[] = [
  { name: 'name', label: '角色标识', required: true, placeholder: '如 doctor, admin' },
  { name: 'display_name', label: '角色名称', required: true, placeholder: '如 医生, 管理员' },
  { name: 'description', label: '描述', type: 'textarea' },
];

const RolePage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  // Permission assignment
  const [permModalVisible, setPermModalVisible] = useState(false);
  const [permissionsTree, setPermissionsTree] = useState<PermissionNode[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [permLoading, setPermLoading] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRoles({ page: 1, page_size: 100 });
      setRoles(res.data.items);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openPermModal = async (role: Role) => {
    setCurrentRole(role);
    setCheckedKeys(role.permissions || []);
    try {
      const res = await getPermissionsTree();
      setPermissionsTree(res.data);
    } catch {
      // silent
    }
    setPermModalVisible(true);
  };

  const handlePermSubmit = async () => {
    if (!currentRole) return;
    setPermLoading(true);
    try {
      await updateRolePermissions(currentRole.id, checkedKeys as string[]);
      message.success('权限更新成功');
      setPermModalVisible(false);
      fetchRoles();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setPermLoading(false);
    }
  };

  const columns: ColumnsType<Role> = [
    { title: '角色标识', dataIndex: 'name', width: 150 },
    { title: '角色名称', dataIndex: 'display_name', width: 150 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', render: formatDateTime, width: 170 },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <PermissionGuard permission="role:manage">
            <Button
              type="link"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => openPermModal(record)}
            >
              配置权限
            </Button>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <PermissionGuard permission="role:manage">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormVisible(true)}>
            新增角色
          </Button>
        </PermissionGuard>
      </div>

      <Table<Role>
        columns={columns}
        dataSource={roles}
        loading={loading}
        rowKey="id"
        pagination={false}
      />

      <AppForm
        title="新增角色"
        visible={formVisible}
        fields={formFields}
        onSubmit={async (values) => {
          await createRole(values as Parameters<typeof createRole>[0]);
          message.success('创建成功');
          setFormVisible(false);
          fetchRoles();
        }}
        onCancel={() => setFormVisible(false)}
      />

      <Modal
        title={`配置权限 - ${currentRole?.display_name || ''}`}
        open={permModalVisible}
        onOk={handlePermSubmit}
        onCancel={() => setPermModalVisible(false)}
        confirmLoading={permLoading}
        width={480}
      >
        <Tree
          checkable
          checkedKeys={checkedKeys}
          onCheck={(keys) => setCheckedKeys(keys as React.Key[])}
          treeData={permissionsTree.map((node) => ({
            key: node.key,
            title: node.title,
            children: node.children?.map((child) => ({
              key: child.key,
              title: child.title,
            })),
          }))}
          defaultExpandAll
        />
      </Modal>
    </>
  );
};

export default RolePage;
