import React, { useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, theme } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  AlertOutlined,
  ScheduleOutlined,
  MedicineBoxOutlined,
  FileSearchOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuthStore } from '../store/auth';
import { useAppStore } from '../store/app';
import { usePermission } from '../hooks/usePermission';

const { Header, Sider, Content } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

const BasicLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { hasAnyPermission } = usePermission();
  const { token: themeToken } = theme.useToken();

  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '工作台',
      },
    ];

    if (hasAnyPermission(['elder:read', 'elder:create'])) {
      items.push({
        key: '/elders',
        icon: <TeamOutlined />,
        label: '老人管理',
        children: [
          { key: '/elders', label: '老人列表' },
          { key: '/elders/archive', label: '老人档案' },
        ],
      });
    }

    if (hasAnyPermission(['alert:read', 'alert:update'])) {
      items.push({
        key: '/alerts',
        icon: <AlertOutlined />,
        label: '风险预警',
      });
    }

    if (hasAnyPermission(['followup:create', 'followup:update'])) {
      items.push({
        key: '/followups',
        icon: <ScheduleOutlined />,
        label: '随访管理',
        children: [
          { key: '/followups/plans', label: '随访计划' },
          { key: '/followups/records', label: '随访记录' },
        ],
      });
    }

    if (hasAnyPermission(['intervention:create'])) {
      items.push({
        key: '/interventions',
        icon: <MedicineBoxOutlined />,
        label: '干预记录',
      });
    }

    if (hasAnyPermission(['assessment:read', 'assessment:create'])) {
      items.push({
        key: '/assessments',
        icon: <FileSearchOutlined />,
        label: '健康评估',
      });
    }

    items.push({
      key: '/accounts',
      icon: <UserOutlined />,
      label: '账户管理',
      children: [
        { key: '/accounts/elders', label: '老人账户' },
        { key: '/accounts/personal', label: '个人账户' },
      ],
    });

    if (hasAnyPermission(['user:manage', 'role:manage'])) {
      items.push({
        key: '/system',
        icon: <SettingOutlined />,
        label: '系统管理',
        children: [
          { key: '/system/users', label: '用户管理' },
          { key: '/system/roles', label: '角色管理' },
        ],
      });
    }

    return items;
  }, [hasAnyPermission]);

  // Determine selected and open keys from current path
  const selectedKeys = useMemo(() => {
    const path = location.pathname;
    // Match exact path first, then try parent paths
    if (path.startsWith('/elders') && !path.includes('/archive')) return ['/elders'];
    if (path.includes('/archive')) return ['/elders/archive'];
    return [path];
  }, [location.pathname]);

  const openKeys = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/elders')) return ['/elders'];
    if (path.startsWith('/followups')) return ['/followups'];
    if (path.startsWith('/accounts')) return ['/accounts'];
    if (path.startsWith('/system')) return ['/system'];
    return [];
  }, [location.pathname]);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'personal',
      icon: <UserOutlined />,
      label: '个人账户',
      onClick: () => navigate('/accounts/personal'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: themeToken.colorBgContainer,
          borderRight: `1px solid ${themeToken.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: sidebarCollapsed ? 14 : 16,
            color: themeToken.colorPrimary,
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
            padding: '0 16px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {sidebarCollapsed ? '医养' : '智慧医养平台'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none' }}
        />
      </Sider>
      <Layout style={{ marginLeft: sidebarCollapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: themeToken.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />}>
              {user?.real_name || user?.username || '用户'}
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;
