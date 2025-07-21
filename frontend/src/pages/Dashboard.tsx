import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Menu,
  SimpleGrid,
  Paper,
  ThemeIcon,
  Skeleton,
} from '@mantine/core';
import {
  IconPlus,
  IconUsers,
  IconFileText,
  IconSettings,
  IconDots,
  IconEdit,
  IconTrash,
  IconUserPlus,
  IconFolder,
  IconClipboardData,
  IconTrendingUp,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

// Components
import AppLayout from '../components/AppLayout';
import CreatePatientGroupModal from '../components/CreatePatientGroupModal';
import StatsCard from '../components/StatsCard';
import { DeadlineAlerts, useDeadlineAlerts } from '../components/DeadlineAlerts';

// Context
import { useAuth } from '../context/AuthContext';
import { usePatientGroup } from '../context/PatientGroupContext';

const Dashboard = () => {
  const { user } = useAuth();
  const { patientGroups, loading, fetchPatientGroups, deletePatientGroup } = usePatientGroup();
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Add deadline alerts hook
  const { summary: deadlineSummary, hasAlerts, alertCount } = useDeadlineAlerts();

  // Mock stats data - in real app, this would come from API
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeDisputes: 0,
    successRate: 0,
    pendingInvitations: 0,
  });

  useEffect(() => {
    fetchPatientGroups();
    
    // Simulate loading stats
    setTimeout(() => {
      setStats({
        totalPatients: patientGroups?.reduce((acc, group) => acc + group.patientCount, 0) || 0,
        activeDisputes: 12, // Mock data
        successRate: 75, // Mock data
        pendingInvitations: user?.notifications?.filter(n => n.type === 'invitation' && !n.isRead).length || 0,
      });
      setStatsLoading(false);
    }, 1000);
  }, []);

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    try {
      await deletePatientGroup(groupId);
      notifications.show({
        title: 'Group Deleted',
        message: `"${groupName}" has been deleted successfully`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete patient group',
        color: 'red',
      });
    }
  };

  const getPermissionBadge = (permission: string) => {
    const colors = {
      admin: 'red',
      edit: 'blue',
      view: 'gray',
    };
    return (
      <Badge color={colors[permission as keyof typeof colors]} size="xs">
        {permission}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <Container size="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between">
            <div>
              <Title order={1}>Welcome back, {user?.firstName}!</Title>
              <Text c="dimmed" size="lg" mt="xs">
                Manage your patient groups and prior authorization disputes
              </Text>
            </div>
            <Button leftSection={<IconPlus size="1rem" />} onClick={openCreateModal}>
              Create Patient Group
            </Button>
          </Group>

          {/* Deadline Alerts - Add this section */}
          {hasAlerts && (
            <DeadlineAlerts showSummary />
          )}

          {/* Stats Grid - Update with deadline alert count */}
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
            <StatsCard
              title="Total Patients"
              value={stats.totalPatients}
              icon={IconUsers}
              color="blue"
              loading={statsLoading}
            />
            <StatsCard
              title="Active Disputes"
              value={stats.activeDisputes}
              icon={IconFileText}
              color="orange"
              loading={statsLoading}
            />
            <StatsCard
              title="Success Rate"
              value={`${stats.successRate}%`}
              icon={IconTrendingUp}
              color="green"
              loading={statsLoading}
            />
            <StatsCard
              title="Deadline Alerts"
              value={alertCount}
              icon={IconAlertTriangle}
              color={hasAlerts ? "red" : "gray"}
              loading={statsLoading}
            />
          </SimpleGrid>

          {/* Patient Groups */}
          <div>
            <Group justify="space-between" mb="md">
              <Title order={2}>Patient Groups</Title>
              <Text c="dimmed" size="sm">
                {patientGroups?.length || 0} groups
              </Text>
            </Group>

            {loading ? (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} height={200} radius="md" />
                ))}
              </SimpleGrid>
            ) : patientGroups && patientGroups.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                {patientGroups.map((group) => {
                  const userPermission = group.members?.find(
                    (member) => member.user._id === user?.id
                  )?.permission || 'view';

                  return (
                    <Card
                      key={group._id}
                      shadow="sm"
                      padding="lg"
                      radius="md"
                      withBorder
                      style={{ cursor: 'pointer' }}
                      onClick={() => window.location.href = `/group/${group._id}`}
                    >
                      <Group justify="space-between" mb="xs">
                        <Group>
                          <ThemeIcon color="blue" variant="light">
                            <IconFolder size="1.1rem" />
                          </ThemeIcon>
                          <Text fw={500} size="lg">
                            {group.name}
                          </Text>
                        </Group>
                        <Menu shadow="md" width={200} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon
                              variant="subtle"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconDots size="1rem" />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconEdit size="0.9rem" />}>
                              Edit Group
                            </Menu.Item>
                            <Menu.Item leftSection={<IconUserPlus size="0.9rem" />}>
                              Invite Members
                            </Menu.Item>
                            <Menu.Item leftSection={<IconSettings size="0.9rem" />}>
                              Settings
                            </Menu.Item>
                            {userPermission === 'admin' && (
                              <>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size="0.9rem" />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteGroup(group._id, group.name);
                                  }}
                                >
                                  Delete Group
                                </Menu.Item>
                              </>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>

                      <Text c="dimmed" size="sm" mb="md">
                        {group.description || 'No description provided'}
                      </Text>

                      <Group justify="space-between" mb="xs">
                        <Group>
                          <Text size="sm" c="dimmed">
                            <IconUsers size="0.9rem" style={{ marginRight: 4 }} />
                            {group.memberCount} members
                          </Text>
                          <Text size="sm" c="dimmed">
                            <IconClipboardData size="0.9rem" style={{ marginRight: 4 }} />
                            {group.patientCount} patients
                          </Text>
                        </Group>
                        {getPermissionBadge(userPermission)}
                      </Group>

                      <Group justify="space-between" mt="md">
                        <Text size="xs" c="dimmed">
                          Owner: {group.owner?.firstName} {group.owner?.lastName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Updated {new Date(group.updatedAt).toLocaleDateString()}
                        </Text>
                      </Group>
                    </Card>
                  );
                })}
              </SimpleGrid>
            ) : (
              <Paper p="xl" radius="md" withBorder>
                <Stack align="center" gap="md">
                  <ThemeIcon size="xl" variant="light" color="gray">
                    <IconFolder size="2rem" />
                  </ThemeIcon>
                  <div style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={500}>
                      No Patient Groups Yet
                    </Text>
                    <Text c="dimmed" mt="xs">
                      Create your first patient group to get started with managing prior authorization disputes
                    </Text>
                  </div>
                  <Button leftSection={<IconPlus size="1rem" />} onClick={openCreateModal}>
                    Create Your First Group
                  </Button>
                </Stack>
              </Paper>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <Title order={2} mb="md">
              Recent Activity
            </Title>
            <Paper p="lg" radius="md" withBorder>
              <Stack>
                <Text c="dimmed" ta="center">
                  Recent activity will appear here once you start creating disputes
                </Text>
              </Stack>
            </Paper>
          </div>
        </Stack>

        {/* Create Patient Group Modal */}
        <CreatePatientGroupModal
          opened={createModalOpened}
          onClose={closeCreateModal}
          onSuccess={() => {
            closeCreateModal();
            fetchPatientGroups();
          }}
        />
      </Container>
    </AppLayout>
  );
};

export default Dashboard;