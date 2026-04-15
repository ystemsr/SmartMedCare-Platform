import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useAppStore } from '../store/app';

const DRAWER_WIDTH = 264;
const MINI_DRAWER_WIDTH = 88;

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

const AppShell: React.FC<AppShellProps> = ({ items, personalPath }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const activeGroups = items.reduce<Record<string, boolean>>((accumulator, item) => {
      if (item.children?.some((child) => matchesPath(child.key, location.pathname))) {
        accumulator[item.key] = true;
      }
      return accumulator;
    }, {});

    setExpandedGroups((previous) => ({ ...previous, ...activeGroups }));
  }, [items, location.pathname]);

  const drawerWidth = sidebarCollapsed ? MINI_DRAWER_WIDTH : DRAWER_WIDTH;

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const brand = useMemo(
    () => (
      <Box
        sx={{
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          px: sidebarCollapsed ? 1.5 : 3,
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'primary.main',
            width: 42,
            height: 42,
            fontWeight: 700,
          }}
        >
          医
        </Avatar>
        {!sidebarCollapsed && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              智慧医养平台
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Smart MedCare
            </Typography>
          </Box>
        )}
      </Box>
    ),
    [sidebarCollapsed],
  );

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {brand}
      <Divider />
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {items.map((item) => {
          const selected = matchesPath(item.key, location.pathname)
            || item.children?.some((child) => matchesPath(child.key, location.pathname));

          if (!item.children?.length) {
            return (
              <Tooltip
                key={item.key}
                title={sidebarCollapsed ? item.label : ''}
                placement="right"
              >
                <ListItemButton
                  selected={selected}
                  onClick={() => handleNavigate(item.key)}
                  sx={{
                    minHeight: 50,
                    mb: 0.5,
                    px: sidebarCollapsed ? 1.5 : 2,
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    borderRadius: 3,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: sidebarCollapsed ? 0 : 1.5,
                      justifyContent: 'center',
                      color: selected ? 'primary.main' : 'inherit',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!sidebarCollapsed && <ListItemText primary={item.label} />}
                </ListItemButton>
              </Tooltip>
            );
          }

          const expanded = expandedGroups[item.key] ?? false;

          return (
            <Fragment key={item.key}>
              <Tooltip title={sidebarCollapsed ? item.label : ''} placement="right">
                <ListItemButton
                  selected={selected}
                  onClick={() =>
                    setExpandedGroups((previous) => ({
                      ...previous,
                      [item.key]: !expanded,
                    }))
                  }
                  sx={{
                    minHeight: 50,
                    mb: 0.5,
                    px: sidebarCollapsed ? 1.5 : 2,
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    borderRadius: 3,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: sidebarCollapsed ? 0 : 1.5,
                      justifyContent: 'center',
                      color: selected ? 'primary.main' : 'inherit',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!sidebarCollapsed && (
                    <>
                      <ListItemText primary={item.label} />
                      {expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                    </>
                  )}
                </ListItemButton>
              </Tooltip>
              {!sidebarCollapsed && (
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                  <List disablePadding sx={{ pl: 1 }}>
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.key}
                        selected={matchesPath(child.key, location.pathname)}
                        onClick={() => handleNavigate(child.key)}
                        sx={{ minHeight: 44, borderRadius: 3, mb: 0.5, pl: 4 }}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>{child.icon}</ListItemIcon>
                        <ListItemText primary={child.label} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              )}
            </Fragment>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        color="inherit"
        elevation={0}
        sx={{
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(18px)',
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
        }}
      >
        <Toolbar sx={{ minHeight: '72px !important', px: { xs: 2, md: 3 } }}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => (isMobile ? setMobileOpen(true) : toggleSidebar())}
            sx={{ mr: 2 }}
          >
            {sidebarCollapsed ? <MenuRoundedIcon /> : <MenuOpenRoundedIcon />}
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">智慧医养平台</Typography>
            <Typography variant="body2" color="text.secondary">
              健康管理与协同服务
            </Typography>
          </Box>
          <Tooltip title="账户菜单">
            <IconButton onClick={(event) => setMenuAnchorEl(event.currentTarget)} color="inherit">
              <Avatar sx={{ bgcolor: 'secondary.main' }}>
                {(user?.real_name || user?.username || 'U').slice(0, 1)}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderColor: 'divider',
              overflowX: 'hidden',
              transition: (theme) =>
                theme.transitions.create('width', {
                  duration: theme.transitions.duration.shorter,
                }),
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          ml: { lg: `${drawerWidth}px` },
        }}
      >
        <Toolbar sx={{ minHeight: '72px !important' }} />
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null);
            navigate(personalPath);
          }}
        >
          <ListItemIcon>
            <PersonRoundedIcon fontSize="small" />
          </ListItemIcon>
          个人账户
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null);
            handleLogout();
          }}
        >
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          退出登录
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default AppShell;
