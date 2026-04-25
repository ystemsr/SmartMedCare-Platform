import React, {
  Fragment,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { IconButton, DropdownMenu, Spinner } from './ui';
import { useAuthStore } from '../store/auth';
import { useAppStore } from '../store/app';
import AIEntryFab from './AIEntryFab';

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

/**
 * Among a set of sibling nav children, pick the one whose key is the
 * longest matching prefix of the pathname. Needed because multiple
 * children can match simultaneously (e.g. both `/bigdata` overview and
 * `/bigdata/inference` match the path `/bigdata/inference`); without
 * this, the first-matching-wins semantics of `Array.find` would always
 * pin the highlight to the overview child.
 */
function findBestChildMatch(
  children: AppShellMenuItem[],
  pathname: string,
): AppShellMenuItem | undefined {
  let best: AppShellMenuItem | undefined;
  for (const c of children) {
    if (matchesPath(c.key, pathname)) {
      if (!best || c.key.length > best.key.length) best = c;
    }
  }
  return best;
}

/**
 * Pick the top-level item with the longest key that matches the
 * pathname, considering its children too. Without this, sibling routes
 * like `/ai` and `/ai/config` both match `/ai/config`, and the first
 * one wins — which would pin the sidebar highlight to "AI 助手" while
 * the user is on "AI 模型配置".
 */
function findBestTopMatch(
  items: AppShellMenuItem[],
  pathname: string,
): AppShellMenuItem | undefined {
  let best: AppShellMenuItem | undefined;
  let bestLen = -1;
  for (const item of items) {
    let localLen = -1;
    if (matchesPath(item.key, pathname)) localLen = item.key.length;
    if (item.children?.length) {
      const child = findBestChildMatch(item.children, pathname);
      if (child && child.key.length > localLen) localLen = child.key.length;
    }
    if (localLen > bestLen) {
      bestLen = localLen;
      best = localLen >= 0 ? item : undefined;
    }
  }
  return best;
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
  mini: boolean;
  isMobile: boolean;
  mouseY: MotionValue<number>;
  onClick: () => void;
  hasChildren?: boolean;
  open?: boolean;
  isChild?: boolean;
  /** Register the DOM node with the parent so the shared active-pill overlay
   * can track its position. Stable across renders. */
  registerNode?: (nodeId: string, el: HTMLButtonElement | null) => void;
  /** Unique id used when registering the DOM node. Namespaced so parent
   * and child items that happen to share the same route key (e.g. a
   * BigData "总览" child reusing the parent's `/bigdata` path) don't
   * collide in the registration map. */
  nodeId: string;
}

const NavItem: React.FC<NavItemProps> = ({
  item,
  selected,
  mini,
  isMobile,
  mouseY,
  onClick,
  hasChildren,
  open,
  isChild,
  registerNode,
  nodeId,
}) => {
  const ref = useRef<HTMLButtonElement>(null);

  // Forward the DOM node up so the parent can position the active pill
  // without relying on viewport coordinates (which break once the nav is
  // scrolled and the previous active item moves off-screen).
  useLayoutEffect(() => {
    registerNode?.(nodeId, ref.current);
    return () => registerNode?.(nodeId, null);
  }, [registerNode, nodeId]);

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
      {/* Active pill is rendered once as an overlay inside the nav
       * container (see AppShell), so per-item background is omitted. */}

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
    const best = findBestTopMatch(items, location.pathname);
    if (best?.children?.length) {
      setExpanded((prev) => ({ ...prev, [best.key]: true }));
    }
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

  // --- Shared active-pill overlay -------------------------------------------
  // A single persistent <motion.div> is positioned in the nav's own scroll
  // content coordinates (offsetTop/Left relative to nav). Because it lives
  // outside the buttons themselves, switching tabs is a smooth transform of
  // one element rather than a layoutId morph between two, so the animation is
  // correct regardless of whether the previous active item has been scrolled
  // out of view.
  const navRef = useRef<HTMLElement | null>(null);
  const itemNodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pillRect, setPillRect] = useState<
    { top: number; left: number; width: number; height: number } | null
  >(null);

  /**
   * Compute the id of the item the pill should sit on. The rule:
   *   - If a child matches the current path AND its submenu is visible
   *     (sidebar expanded + parent expanded), highlight that child.
   *   - Otherwise, if either the parent matches OR one of its children
   *     matches but the submenu is collapsed/hidden, highlight the
   *     parent instead.
   *
   * Namespaced ids (`top:` / `child:`) prevent parent and child buttons
   * that happen to reuse the same route path from overwriting each
   * other in the DOM-node registry.
   */
  const bestTopItem = useMemo(
    () => findBestTopMatch(items, location.pathname),
    [items, location.pathname],
  );

  const activeKey = useMemo(() => {
    if (!bestTopItem) return null;
    if (bestTopItem.children?.length) {
      const submenuVisible = !mini && (expanded[bestTopItem.key] ?? false);
      const childMatch = findBestChildMatch(
        bestTopItem.children,
        location.pathname,
      );
      if (childMatch && submenuVisible) {
        return `child:${bestTopItem.key}:${childMatch.key}`;
      }
    }
    return `top:${bestTopItem.key}`;
  }, [bestTopItem, location.pathname, expanded, mini]);

  const registerNode = useCallback(
    (key: string, el: HTMLButtonElement | null) => {
      if (el) itemNodeRefs.current.set(key, el);
      else itemNodeRefs.current.delete(key);
    },
    [],
  );

  const measurePill = useCallback(() => {
    if (!activeKey) {
      setPillRect(null);
      return;
    }
    const btn = itemNodeRefs.current.get(activeKey);
    const nav = navRef.current;
    if (!btn || !nav) {
      setPillRect(null);
      return;
    }
    // Use getBoundingClientRect-relative math instead of offsetTop/Left:
    // the submenu has `position: relative` (for its vertical divider
    // ::before pseudo), which makes IT the offsetParent for child
    // buttons, not the nav. Reading offsetTop would therefore return
    // the child's position within the submenu — wrong — and the pill
    // would appear stuck near the parent.
    const btnRect = btn.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    setPillRect({
      top: btnRect.top - navRect.top + nav.scrollTop,
      left: btnRect.left - navRect.left + nav.scrollLeft,
      width: btnRect.width,
      height: btnRect.height,
    });
  }, [activeKey]);

  // Re-measure whenever the active key changes or the surrounding layout
  // shifts (sidebar collapse, submenu expand/collapse, viewport size).
  useLayoutEffect(() => {
    // Double rAF: wait for framer's sidebar-width spring and subnav
    // height animations to settle their first frame before measuring.
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(measurePill);
    });
    return () => window.cancelAnimationFrame(id);
  }, [measurePill, mini, expanded, isMobile]);

  useEffect(() => {
    const onResize = () => measurePill();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measurePill]);

  const renderItem = (item: AppShellMenuItem) => {
    const selected = bestTopItem?.key === item.key;

    if (!item.children?.length) {
      return (
        <NavItem
          key={item.key}
          nodeId={`top:${item.key}`}
          item={item}
          selected={selected}
          mini={mini}
          isMobile={isMobile}
          mouseY={mouseY}
          onClick={() => go(item.key)}
          registerNode={registerNode}
        />
      );
    }

    const open = expanded[item.key] ?? false;
    return (
      <Fragment key={item.key}>
        <NavItem
          nodeId={`top:${item.key}`}
          item={item}
          selected={selected}
          mini={mini}
          isMobile={isMobile}
          mouseY={mouseY}
          onClick={() => setExpanded((p) => ({ ...p, [item.key]: !open }))}
          hasChildren
          open={open}
          registerNode={registerNode}
        />
        {!mini && (
          /* CSS grid-template-rows trick: the wrapper transitions
           * between 0fr (collapsed) and 1fr (expanded). The inner
           * `.smc-shell__subnav` always renders at its natural height,
           * so there is no JS-side measurement that can go stale when
           * the nav grows a scrollbar mid-animation. */
          <div
            className={`smc-shell__subnav-wrap${
              open ? ' smc-shell__subnav-wrap--open' : ''
            }`}
            aria-hidden={!open}
            onTransitionEnd={measurePill}
          >
            <div className="smc-shell__subnav">
              {(() => {
                const bestChild = findBestChildMatch(
                  item.children!,
                  location.pathname,
                );
                return item.children!.map((child) => {
                  const cs = bestChild?.key === child.key;
                  return (
                    <NavItem
                      key={child.key}
                      nodeId={`child:${item.key}:${child.key}`}
                      item={child}
                      selected={cs}
                      mini={false}
                      isMobile={isMobile}
                      mouseY={mouseY}
                      onClick={() => go(child.key)}
                      isChild
                      registerNode={registerNode}
                    />
                  );
                });
              })()}
            </div>
          </div>
        )}
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
      <nav
        ref={navRef}
        className="smc-shell__nav"
        style={{ position: 'relative' }}
      >
        {pillRect && (
          <motion.div
            aria-hidden
            className="smc-navitem__bg"
            initial={false}
            animate={{
              top: pillRect.top,
              left: pillRect.left,
              width: pillRect.width,
              height: pillRect.height,
              opacity: 1,
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}
        {items.map(renderItem)}
      </nav>
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
            {(() => {
              // Build breadcrumb from menu tree + current pathname.
              let crumbs: { label: string; key?: string }[] = [];
              if (bestTopItem) {
                const childMatch = bestTopItem.children?.length
                  ? findBestChildMatch(
                      bestTopItem.children,
                      location.pathname,
                    )
                  : undefined;
                if (childMatch) {
                  crumbs = [
                    { label: bestTopItem.label, key: bestTopItem.key },
                    { label: childMatch.label, key: childMatch.key },
                  ];
                } else {
                  crumbs = [
                    { label: bestTopItem.label, key: bestTopItem.key },
                  ];
                }
              }
              const primaryRole = user?.roles?.[0];
              const roleLabel =
                primaryRole === 'admin'
                  ? '管理员'
                  : primaryRole === 'doctor'
                    ? '医生'
                    : primaryRole === 'elder'
                      ? '老人'
                      : primaryRole === 'family'
                        ? '家属'
                        : '用户';
              return (
                <div className="ref-crumbs">
                  <span className="ref-crumbs__role">
                    {roleLabel} · {user?.real_name || user?.username || ''}
                  </span>
                  {crumbs.map((c, i) => (
                    <React.Fragment key={i}>
                      <span className="ref-crumbs__sep">/</span>
                      {i === crumbs.length - 1 ? (
                        <span className="ref-crumbs__cur">{c.label}</span>
                      ) : (
                        <span style={{ color: 'var(--smc-text-2)' }}>
                          {c.label}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                  {crumbs.length === 0 && (
                    <span className="ref-crumbs__cur">智慧医养平台</span>
                  )}
                </div>
              );
            })()}
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
        <div className="smc-shell__scroll">
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
      <AIEntryFab />
    </div>
  );
};

export default AppShell;
