import type { ReactNode } from 'react';
import {
  AppShell,
  Text,
  Group,
  Button,
  Menu,
  Avatar,
  ThemeIcon,
  NavLink,
  ActionIcon,
  Badge,
  Stack,
  Divider,
  Switch,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconDashboard,
  IconUsers,
  IconFileText,
  IconSettings,
  IconLogout,
  IconBell,
  IconSun,
  IconMoon,
  IconChevronDown,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDeadlineAlerts } from '../components/DeadlineAlerts';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, logout, updatePreferences } = useAuth();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [navbarOpened, setNavbarOpened] = useState(false);
  
  // Add deadline alerts hook
  const { hasAlerts, alertCount } = useDeadlineAlerts();

  const handleThemeChange = async () => {
    const newTheme = colorScheme === 'dark' ? 'light' : 'dark';
    toggleColorScheme();
    try {
      await updatePreferences({ theme: newTheme });
    } catch (error) {
      console.error('Failed to update theme preference:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const unreadNotifications = user?.notifications?.filter(n => !n.isRead).length || 0;

  const navigationItems = [
    {
      icon: IconDashboard,
      label: 'Dashboard',
      path: '/dashboard',
      badge: hasAlerts ? alertCount : undefined,
      badgeColor: 'red',
    },
    {
      icon: IconUsers,
      label: 'Patient Groups',
      path: '/dashboard', // Same as dashboard for now
    },
    {
      icon: IconFileText,
      label: 'All Disputes',
      path: '/disputes',
    },
    {
      icon: IconSettings,
      label: 'Settings',
      path: '/settings',
    },
  ];

  return (
    <AppShell
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !navbarOpened },
      }}
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
              <IconFileText size="1.2rem" />
            </ThemeIcon>
            <Text size="lg" fw={600}>
              PriorAuth Dispute
            </Text>
          </Group>

          <Group>
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handleThemeChange}
              title={`Switch to ${colorScheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {colorScheme === 'dark' ? <IconSun size="1.1rem" /> : <IconMoon size="1.1rem" />}
            </ActionIcon>

            {/* Add deadline alerts indicator */}
            {hasAlerts && (
              <ActionIcon 
                variant="subtle" 
                size="lg" 
                color="red"
                onClick={() => navigate('/dashboard')}
                style={{ position: 'relative' }}
              >
                <IconAlertTriangle size="1.1rem" />
                <Badge
                  size="xs"
                  color="red"
                  style={{ position: 'absolute', top: 2, right: 2 }}
                >
                  {alertCount}
                </Badge>
              </ActionIcon>
            )}

            <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/notifications')}>
              <IconBell size="1.1rem" />
              {unreadNotifications > 0 && (
                <Badge
                  size="xs"
                  color="red"
                  style={{ position: 'absolute', top: 5, right: 5 }}
                >
                  {unreadNotifications}
                </Badge>
              )}
            </ActionIcon>

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button variant="subtle" rightSection={<IconChevronDown size="0.9rem" />}>
                  <Group gap="xs">
                    <Avatar size="sm" color="blue">
                      {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                    </Avatar>
                    <div style={{ textAlign: 'left' }}>
                      <Text size="sm" fw={500}>
                        {user?.firstName} {user?.lastName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {user?.role}
                      </Text>
                    </div>
                  </Group>
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Account</Menu.Label>
                <Menu.Item leftSection={<IconSettings size="0.9rem" />}>
                  Profile Settings
                </Menu.Item>
                <Menu.Item leftSection={<IconBell size="0.9rem" />}>
                  Notifications
                  {unreadNotifications > 0 && (
                    <Badge size="xs" color="red" ml="auto">
                      {unreadNotifications}
                    </Badge>
                  )}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconLogout size="0.9rem" />}
                  color="red"
                  onClick={handleLogout}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
            Navigation
          </Text>
          
          {navigationItems.map((item) => (
            <NavLink
              key={item.path}
              href={item.path}
              label={
                <Group justify="space-between" wrap="nowrap">
                  <Text>{item.label}</Text>
                  {item.badge && (
                    <Badge size="xs" color={item.badgeColor}>
                      {item.badge}
                    </Badge>
                  )}
                </Group>
              }
              leftSection={<item.icon size="1rem" />}
              active={location.pathname === item.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.path);
                setNavbarOpened(false);
              }}
            />
          ))}

          <Divider my="sm" />

          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
            Quick Actions
          </Text>

          <NavLink
            label="Create Patient Group"
            leftSection={<IconUsers size="1rem" />}
            onClick={() => {
              navigate('/dashboard');
              setNavbarOpened(false);
            }}
          />

          <NavLink
            label="New Dispute"
            leftSection={<IconFileText size="1rem" />}
            onClick={() => {
              navigate('/dashboard');
              setNavbarOpened(false);
            }}
          />
        </Stack>

        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <Divider mb="sm" />
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed">
              Theme
            </Text>
            <Switch
              size="sm"
              checked={colorScheme === 'dark'}
              onChange={handleThemeChange}
              onLabel={<IconMoon size="0.7rem" />}
              offLabel={<IconSun size="0.7rem" />}
            />
          </Group>
        </div>
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
};

export default AppLayout;