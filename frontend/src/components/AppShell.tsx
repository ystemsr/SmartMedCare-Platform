import React, { Fragment, type ReactNode, useEffect, useState } from 'react';
import { ChevronRight, LogOut, Menu as MenuIcon, PanelLeftClose, User } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IconButton, DropdownMenu, Tooltip } from './ui';
import { useAuthStore } from '../store/auth';
import { useAppStore } from '../store/app';

export interface AppShellMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  children?: AppShellMenuItem[];
}

interface AppShellProps {
  items: AppShellMenuItem[];
  personalPath: string;
}

function matchesPath(itemKey: string, pathname: string) {
  return pathname === itemKey || pathname.startsWith(`${itemKey}/`);
}

function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

const AppShell: React.FC<AppShellProps> = ({ items, personalPath }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const active = items.reduce<Record<string, boolean>>((acc, item) => {
      if (item.children?.some((c) => matchesPath(c.key, location.pathname))) {
        acc[item.key] = true;
      }
      return acc;
    }, {});
    setExpanded((prev) => ({ ...prev, ...active }));
  }, [items, location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const go = (path: string) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const mini = sidebarCollapsed && !isMobile;

  const renderItem = (item: AppShellMenuItem) => {
    const selected =
      matchesPath(item.key, location.pathname) ||
      item.children?.some((c) => matchesPath(c.key, location.pathname));
    if (!item.children?.length) {
      const btn = (
        <button
          type="button"
          className={`smc-navitem ${selected ? 'smc-navitem--active' : ''}`}
          onClick={() => go(item.key)}
        >
          <span style={{ display: 'inline-flex' }}>{item.icon}</span>
          {!mini && <span className="smc-navitem__label">{item.label}</span>}
        </button>
      );
      return mini ? (
        <Tooltip key={item.key} title={item.label} placement="right">
          {btn}
        </Tooltip>
      ) : (
        <Fragment key={item.key}>{btn}</Fragment>
      );
    }
    const open = expanded[item.key] ?? false;
    return (
      <Fragment key={item.key}>
        <button
          type="button"
          className={`smc-navitem ${selected ? 'smc-navitem--active' : ''}`}
          onClick={() => setExpanded((p) => ({ ...p, [item.key]: !open }))}
        >
          <span style={{ display: 'inline-flex' }}>{item.icon}</span>
          {!mini && <span className="smc-navitem__label">{item.label}</span>}
          {!mini && (
            <ChevronRight
              size={14}
              className={`smc-navitem__caret ${open ? 'smc-navitem__caret--open' : ''}`}
            />
          )}
        </button>
        {!mini && open && (
          <div className="smc-shell__subnav">
            {item.children.map((child) => {
              const childSelected = matchesPath(child.key, location.pathname);
              return (
                <button
                  key={child.key}
                  type="button"
                  className={`smc-navitem smc-navitem--child ${childSelected ? 'smc-navitem--active' : ''}`}
                  onClick={() => go(child.key)}
                >
                  <span style={{ display: 'inline-flex' }}>{child.icon}</span>
                  <span className="smc-navitem__label">{child.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </Fragment>
    );
  };

  const sidebar = (
    <aside
      className={[
        'smc-shell__sidebar',
        mini && 'smc-shell__sidebar--mini',
        isMobile && mobileOpen && 'smc-shell__sidebar--open',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="smc-shell__brand">
        <img src="/favicon.svg" alt="SmartMedCare" className="smc-shell__brand-img" />
        {!mini && (
          <div>
            <div className="smc-shell__brand-text">智慧医养平台</div>
            <div className="smc-shell__brand-sub">Smart MedCare</div>
          </div>
        )}
      </div>
      <nav className="smc-shell__nav">{items.map(renderItem)}</nav>
    </aside>
  );

  const avatar = (
    <span
      className="smc-avatar"
      style={{ cursor: 'pointer' }}
      title="账户菜单"
    >
      {(user?.real_name || user?.username || 'U').slice(0, 1)}
    </span>
  );

  return (
    <div className="smc-shell">
      {isMobile && mobileOpen && (
        <div className="smc-shell__backdrop" onClick={() => setMobileOpen(false)} />
      )}
      {sidebar}
      <div className="smc-shell__main">
        <header className="smc-shell__header">
          <IconButton
            onClick={() => (isMobile ? setMobileOpen(true) : toggleSidebar())}
            aria-label={sidebarCollapsed ? '展开菜单' : '收起菜单'}
          >
            {sidebarCollapsed ? <MenuIcon size={18} /> : <PanelLeftClose size={18} />}
          </IconButton>
          <div className="smc-shell__title-wrap">
            <div className="smc-shell__title">智慧医养平台</div>
            <div className="smc-shell__sub">健康管理与协同服务</div>
          </div>
          <DropdownMenu
            trigger={avatar}
            items={[
              {
                key: 'user',
                header: true,
                title: user?.real_name || user?.username || '用户',
                subtitle: user?.phone || '',
              },
              {
                key: 'personal',
                label: '个人账户',
                icon: <User size={15} />,
                onSelect: () => go(personalPath),
              },
              { key: 'd1', label: '', divider: true },
              {
                key: 'logout',
                label: '退出登录',
                icon: <LogOut size={15} />,
                danger: true,
                onSelect: handleLogout,
              },
            ]}
          />
        </header>
        <main className="smc-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
