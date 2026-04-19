import React, {
  Fragment,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  User,
} from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { IconButton, DropdownMenu, Spinner } from './ui';
import { useAuthStore } from '../store/auth';
import { useAppStore } from '../store/app';

export interface AppShellMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  children?: AppShellMenuItem[];
  /** Optional unread / pending count; rendered as a red circular badge. */
  badge?: number;
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

interface NavItemProps {
  item: AppShellMenuItem;
  selected: boolean;
  showActivePill: boolean;
  mini: boolean;
  isMobile: boolean;
  mouseY: MotionValue<number>;
  onClick: () => void;
  hasChildren?: boolean;
  open?: boolean;
  isChild?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({
  item,
  selected,
  showActivePill,
  mini,
  isMobile,
  mouseY,
  onClick,
  hasChildren,
  open,
  isChild,
}) => {
  const ref = useRef<HTMLButtonElement>(null);

  const distance = useTransform(mouseY, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 };
    return val - bounds.y - bounds.height / 2;
  });

  // Collapsed: pronounced dock scale effect
  const collapsedScaleSync = useTransform(distance, [-120, 0, 120], [1, 2.2, 1]);
  const collapsedScale = useSpring(collapsedScaleSync, {
    mass: 0.1,
    stiffness: 200,
    damping: 15,
  });

  // Expanded: subtle hover scale
  const baseScale = selected ? 1.05 : 1;
  const expandedScaleSync = useTransform(
    distance,
    [-80, 0, 80],
    [baseScale, selected ? 1.18 : 1.12, baseScale],
  );
  const expandedScale = useSpring(expandedScaleSync, {
    mass: 0.1,
    stiffness: 300,
    damping: 20,
  });

  // Floating tooltip animations for collapsed state
  const labelOpacity = useTransform(distance, [-30, 0, 30], [0, 1, 0]);
  const labelX = useTransform(distance, [-30, 0, 30], [10, 20, 10]);
  const labelScale = useTransform(distance, [-30, 0, 30], [0.8, 1, 0.8]);

  const isDesktop = !isMobile;
  const useCollapsedScale = mini && isDesktop;
  const useExpandedScale = !mini && isDesktop;

  const activeScale = useCollapsedScale
    ? collapsedScale
    : useExpandedScale
      ? expandedScale
      : baseScale;

  const zIndex = useTransform(distance, (d) => (Math.abs(d) < 60 ? 50 : 1));

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      style={{ zIndex }}
      className={[
        'smc-navitem',
        selected && 'smc-navitem--active',
        mini && 'smc-navitem--mini',
        isChild && 'smc-navitem--child',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showActivePill && (
        <motion.span
          layoutId="smc-navitem-active"
          className="smc-navitem__bg"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}

      <motion.span
        style={{ scale: activeScale, position: 'relative' }}
        className="smc-navitem__icon"
      >
        {item.icon}
        {typeof item.badge === 'number' && item.badge > 0 && (
          <span
            aria-label={`${item.badge} 项待办`}
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              minWidth: 14,
              height: 14,
              padding: '0 3px',
              borderRadius: 7,
              background: 'var(--smc-error)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              lineHeight: '14px',
              textAlign: 'center',
              boxShadow: '0 0 0 1.5px var(--smc-bg, #fff)',
              pointerEvents: 'none',
            }}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </motion.span>

      <motion.span
        initial={false}
        animate={{
          opacity: mini ? 0 : 1,
          display: mini ? 'none' : 'inline-flex',
        }}
        style={{
          scale: useExpandedScale ? expandedScale : 1,
          originX: 0,
        }}
        transition={{ duration: 0.2 }}
        className="smc-navitem__label"
      >
        {item.label}
      </motion.span>

      {!mini && hasChildren && (
        <ChevronRight
          size={14}
          className={`smc-navitem__caret ${open ? 'smc-navitem__caret--open' : ''}`}
        />
      )}

      {useCollapsedScale && (
        <motion.span
          style={{
            opacity: labelOpacity,
            x: labelX,
            scale: labelScale,
          }}
          className="smc-navitem__floating"
        >
          {item.label}
        </motion.span>
      )}
    </motion.button>
  );
};

const AppShell: React.FC<AppShellProps> = ({ items, personalPath }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mouseY = useMotionValue(Number.POSITIVE_INFINITY);

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
    const childSelected = item.children?.some((c) =>
      matchesPath(c.key, location.pathname),
    );
    const selfSelected = matchesPath(item.key, location.pathname);
    const selected = selfSelected || !!childSelected;
    // Only one element should own the active-pill layoutId at a time.
    // For parents with children, let the child own it when a child is selected.
    const showActivePill = selfSelected && !childSelected;

    if (!item.children?.length) {
      return (
        <NavItem
          key={item.key}
          item={item}
          selected={selected}
          showActivePill={selected}
          mini={mini}
          isMobile={isMobile}
          mouseY={mouseY}
          onClick={() => go(item.key)}
        />
      );
    }

    const open = expanded[item.key] ?? false;
    return (
      <Fragment key={item.key}>
        <NavItem
          item={item}
          selected={selected}
          showActivePill={showActivePill}
          mini={mini}
          isMobile={isMobile}
          mouseY={mouseY}
          onClick={() => setExpanded((p) => ({ ...p, [item.key]: !open }))}
          hasChildren
          open={open}
        />
        <AnimatePresence initial={false}>
          {!mini && open && (
            <motion.div
              key={`${item.key}-sub`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="smc-shell__subnav"
            >
              {item.children!.map((child) => {
                const cs = matchesPath(child.key, location.pathname);
                return (
                  <NavItem
                    key={child.key}
                    item={child}
                    selected={cs}
                    showActivePill={cs}
                    mini={false}
                    isMobile={isMobile}
                    mouseY={mouseY}
                    onClick={() => go(child.key)}
                    isChild
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </Fragment>
    );
  };

  const sidebar = (
    <motion.aside
      initial={false}
      animate={{ width: mini ? 64 : 264 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={[
        'smc-shell__sidebar',
        mini && 'smc-shell__sidebar--mini',
        isMobile && mobileOpen && 'smc-shell__sidebar--open',
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseMove={(e) => !isMobile && mouseY.set(e.clientY)}
      onMouseLeave={() => mouseY.set(Number.POSITIVE_INFINITY)}
    >
      <div
        className={`smc-shell__brand ${mini ? 'smc-shell__brand--mini' : ''}`}
      >
        {!mini && (
          <div className="smc-shell__brand-info">
            <img
              src="/favicon.svg"
              alt="SmartMedCare"
              className="smc-shell__brand-img"
            />
            <div>
              <div className="smc-shell__brand-text">智慧医养平台</div>
              <div className="smc-shell__brand-sub">Smart MedCare</div>
            </div>
          </div>
        )}
        {!isMobile && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="smc-shell__toggle"
            aria-label={sidebarCollapsed ? '展开菜单' : '收起菜单'}
          >
            {mini ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>
      <nav className="smc-shell__nav">{items.map(renderItem)}</nav>
    </motion.aside>
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
          {isMobile && (
            <IconButton
              onClick={() => setMobileOpen(true)}
              aria-label="展开菜单"
            >
              <MenuIcon size={18} />
            </IconButton>
          )}
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
          <Suspense
            fallback={
              <div className="smc-shell__content-loader">
                <Spinner size="lg" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
