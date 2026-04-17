import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { Button, Checkbox, Modal } from '../../components/ui';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { getRoles, createRole, updateRolePermissions, getPermissionsTree } from '../../api/system';
import { formatDateTime } from '../../utils/formatter';
import type { PermissionNode, Role } from '../../types/user';
import { message } from '../../utils/message';

const formFields: FormFieldConfig[] = [
  { name: 'name', label: '角色标识', required: true, placeholder: '如 doctor, admin' },
  { name: 'display_name', label: '角色名称', required: true, placeholder: '如 医生, 管理员' },
  { name: 'description', label: '描述', type: 'textarea' },
];

function collectNodeKeys(node: PermissionNode): string[] {
  return [node.key, ...(node.children?.flatMap(collectNodeKeys) ?? [])];
}

function PermissionTreeNode({
  node,
  depth,
  selectedKeys,
  onToggle,
}: {
  node: PermissionNode;
  depth: number;
  selectedKeys: Set<string>;
  onToggle: (node: PermissionNode, checked: boolean) => void;
}) {
  const nodeKeys = useMemo(() => collectNodeKeys(node), [node]);
  const selectedCount = nodeKeys.filter((key) => selectedKeys.has(key)).length;
  const checked = selectedCount === nodeKeys.length;
  const indeterminate = selectedCount > 0 && selectedCount < nodeKeys.length;

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={(event) => onToggle(node, event.target.checked)}
        label={
          <span style={{ fontWeight: depth === 0 ? 600 : 400, fontSize: 14 }}>{node.title}</span>
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {node.children?.map((child) => (
          <PermissionTreeNode
            key={child.key}
            node={child}
            depth={depth + 1}
            selectedKeys={selectedKeys}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

const RolePage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [permModalVisible, setPermModalVisible] = useState(false);
  const [permissionsTree, setPermissionsTree] = useState<PermissionNode[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [permLoading, setPermLoading] = useState(false);

  const checkedKeySet = useMemo(() => new Set(checkedKeys), [checkedKeys]);

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
      setPermissionsTree([]);
    }
    setPermModalVisible(true);
  };

  const handlePermToggle = (node: PermissionNode, checked: boolean) => {
    const nodeKeys = collectNodeKeys(node);
    setCheckedKeys((previous) => {
      const next = new Set(previous);
      nodeKeys.forEach((key) => {
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
      return Array.from(next);
    });
  };

  const handlePermSubmit = async () => {
    if (!currentRole) return;
    setPermLoading(true);
    try {
      await updateRolePermissions(currentRole.id, checkedKeys);
      message.success('权限更新成功');
      setPermModalVisible(false);
      fetchRoles();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setPermLoading(false);
    }
  };

  const columns: AppTableColumn<Role>[] = [
    { title: '角色标识', dataIndex: 'name', width: 150 },
    { title: '角色名称', dataIndex: 'display_name', width: 150 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <PermissionGuard permission="role:manage">
          <Button
            size="sm"
            variant="text"
            startIcon={<Settings size={14} />}
            onClick={() => openPermModal(record)}
          >
            配置权限
          </Button>
        </PermissionGuard>
      ),
    },
  ];

  return (
    <>
      <AppTable<Role>
        columns={columns}
        dataSource={roles}
        loading={loading}
        pagination={false}
        toolbar={
          <PermissionGuard permission="role:manage">
            <Button startIcon={<Plus size={14} />} onClick={() => setFormVisible(true)}>
              新增角色
            </Button>
          </PermissionGuard>
        }
      />

      <AppForm
        title="新增角色"
        visible={formVisible}
        fields={formFields}
        confirmLoading={submitLoading}
        onSubmit={async (values) => {
          setSubmitLoading(true);
          try {
            await createRole(values as Parameters<typeof createRole>[0]);
            message.success('创建成功');
            setFormVisible(false);
            fetchRoles();
          } finally {
            setSubmitLoading(false);
          }
        }}
        onCancel={() => setFormVisible(false)}
      />

      <Modal
        open={permModalVisible}
        onClose={() => setPermModalVisible(false)}
        title={`配置权限 - ${currentRole?.display_name || ''}`}
        width={560}
        footer={
          <>
            <Button variant="outlined" onClick={() => setPermModalVisible(false)}>
              取消
            </Button>
            <Button onClick={handlePermSubmit} loading={permLoading}>
              {permLoading ? '保存中...' : '确定'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>
            勾选权限后将覆盖该角色现有权限。
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {permissionsTree.map((node) => (
              <PermissionTreeNode
                key={node.key}
                node={node}
                depth={0}
                selectedKeys={checkedKeySet}
                onToggle={handlePermToggle}
              />
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default RolePage;
