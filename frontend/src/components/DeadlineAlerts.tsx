// components/DeadlineAlerts.tsx
import { useState, useEffect } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  ThemeIcon,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Timeline,
  Progress,
  Divider,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconClock,
  IconCalendar,
  IconCheck,
  IconX,
  IconEdit,
  IconExternalLink,
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

interface DeadlineFlag {
  _id: string;
  type: 'warning' | 'urgent' | 'overdue';
  daysRemaining: number;
  flaggedAt: string;
  resolved: boolean;
}

interface Deadline {
  responseDeadline: string;
  urgentResponseDeadline?: string;
  externalReviewDeadline?: string;
  deadlineFlags: DeadlineFlag[];
}

interface DeadlineSummary {
  overdue: number;
  urgent: number;
  warning: number;
  total: number;
  details: Array<{
    disputeId: string;
    patientName: string;
    service: string;
    deadline: string;
    daysRemaining: number;
    category: 'overdue' | 'urgent' | 'warning';
    status: string;
  }>;
}

interface DeadlineAlertsProps {
  disputeId?: string;
  showSummary?: boolean;
  inline?: boolean;
}

export const DeadlineAlerts: React.FC<DeadlineAlertsProps> = ({
  disputeId,
  showSummary = false,
  inline = false,
}) => {
  const [deadlines, setDeadlines] = useState<Deadline | null>(null);
  const [summary, setSummary] = useState<DeadlineSummary | null>(null);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const navigate = useNavigate();

  const editForm = useForm({
    initialValues: {
      newDeadline: new Date(),
      deadlineType: 'responseDeadline',
      reason: '',
    },
  });

  useEffect(() => {
    if (disputeId) {
      fetchDeadlines();
    } else if (showSummary) {
      fetchDeadlineSummary();
    }
  }, [disputeId, showSummary]);

  const fetchDeadlines = async () => {
    if (!disputeId) return;
    
    try {
      const response = await api.get(`/disputes/${disputeId}/validation-status`);
      if (response.data.success) {
        setDeadlines(response.data.deadlines);
      }
    } catch (error) {
      console.error('Failed to fetch deadlines:', error);
    }
  };

  const fetchDeadlineSummary = async () => {
    try {
      const response = await api.get('/disputes/deadlines/summary');
      if (response.data.success) {
        setSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch deadline summary:', error);
    }
  };

  const resolveFlag = async (flagId: string) => {
    if (!disputeId) return;

    try {
      await api.post(`/disputes/${disputeId}/resolve-deadline-flag/${flagId}`);
      await fetchDeadlines();
      notifications.show({
        title: 'Flag Resolved',
        message: 'Deadline reminder has been acknowledged',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to resolve flag',
        color: 'red',
      });
    }
  };

  const updateDeadline = async (values: any) => {
    if (!disputeId) return;

    try {
      await api.put(`/disputes/${disputeId}/deadline`, {
        newDeadline: values.newDeadline.toISOString(),
        deadlineType: values.deadlineType,
      });
      
      await fetchDeadlines();
      setEditModalOpened(false);
      editForm.reset();
      
      notifications.show({
        title: 'Deadline Updated',
        message: 'Response deadline has been updated successfully',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update deadline',
        color: 'red',
      });
    }
  };

  const getFlagColor = (type: string) => {
    switch (type) {
      case 'overdue':
        return 'red';
      case 'urgent':
        return 'orange';
      case 'warning':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const getFlagIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return <IconX size="1rem" />;
      case 'urgent':
        return <IconAlertTriangle size="1rem" />;
      case 'warning':
        return <IconClock size="1rem" />;
      default:
        return <IconClock size="1rem" />;
    }
  };

  const getFlagMessage = (flag: DeadlineFlag) => {
    switch (flag.type) {
      case 'overdue':
        return `Response deadline passed ${flag.daysRemaining} days ago`;
      case 'urgent':
        return `Response deadline in ${flag.daysRemaining} days - Urgent action needed`;
      case 'warning':
        return `Response deadline in ${flag.daysRemaining} days`;
      default:
        return `Deadline reminder`;
    }
  };

  // Summary view for dashboard
  if (showSummary && summary) {
    return (
      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Text fw={600} size="lg">Deadline Alerts</Text>
            <Badge color={summary.overdue > 0 ? 'red' : summary.urgent > 0 ? 'orange' : 'green'}>
              {summary.overdue + summary.urgent + summary.warning} Active
            </Badge>
          </Group>

          {summary.overdue + summary.urgent + summary.warning === 0 ? (
            <Alert color="green" icon={<IconCheck size="1rem" />}>
              <Text size="sm">All disputes are within deadline requirements</Text>
            </Alert>
          ) : (
            <Stack gap="xs">
              {summary.overdue > 0 && (
                <Alert color="red" icon={<IconX size="1rem" />}>
                  <Text fw={500}>{summary.overdue} Overdue Responses</Text>
                  <Text size="sm">Immediate action required</Text>
                </Alert>
              )}

              {summary.urgent > 0 && (
                <Alert color="orange" icon={<IconAlertTriangle size="1rem" />}>
                  <Text fw={500}>{summary.urgent} Urgent Deadlines (≤3 days)</Text>
                  <Text size="sm">Priority attention needed</Text>
                </Alert>
              )}

              {summary.warning > 0 && (
                <Alert color="yellow" icon={<IconClock size="1rem" />}>
                  <Text fw={500}>{summary.warning} Upcoming Deadlines (≤7 days)</Text>
                  <Text size="sm">Plan submission soon</Text>
                </Alert>
              )}

              <Divider />

              <Stack gap="xs">
                {summary.details.slice(0, 5).map((detail) => (
                  <Group
                    key={detail.disputeId}
                    justify="space-between"
                    p="xs"
                    style={{
                      backgroundColor: 'var(--mantine-color-gray-0)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/dispute/${detail.disputeId}`)}
                  >
                    <div>
                      <Text size="sm" fw={500}>{detail.patientName}</Text>
                      <Text size="xs" c="dimmed">{detail.service}</Text>
                    </div>
                    <Group>
                      <Badge size="xs" color={getFlagColor(detail.category)}>
                        {detail.category === 'overdue' ? 'OVERDUE' : `${detail.daysRemaining}d`}
                      </Badge>
                      <ActionIcon size="sm" variant="subtle">
                        <IconExternalLink size="0.8rem" />
                      </ActionIcon>
                    </Group>
                  </Group>
                ))}

                {summary.details.length > 5 && (
                  <Button variant="subtle" size="sm" fullWidth>
                    View all {summary.details.length} deadline alerts
                  </Button>
                )}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Card>
    );
  }

  // Individual dispute view
  if (disputeId && deadlines) {
    const activeFlags = deadlines.deadlineFlags?.filter(flag => !flag.resolved) || [];

    if (activeFlags.length === 0 && !inline) {
      return null;
    }

    return (
      <Stack>
        {activeFlags.map((flag) => (
          <Alert
            key={flag._id}
            color={getFlagColor(flag.type)}
            icon={getFlagIcon(flag.type)}
          >
            <Group justify="space-between">
              <div>
                <Text fw={500}>{getFlagMessage(flag)}</Text>
                <Text size="sm" c="dimmed">
                  Flagged on {new Date(flag.flaggedAt).toLocaleDateString()}
                </Text>
              </div>
              <Group>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => {
                    editForm.setFieldValue('newDeadline', new Date(deadlines.responseDeadline));
                    setEditModalOpened(true);
                  }}
                >
                  <IconEdit size="0.8rem" />
                </ActionIcon>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => resolveFlag(flag._id)}
                >
                  <IconCheck size="0.8rem" />
                </ActionIcon>
              </Group>
            </Group>
          </Alert>
        ))}

        {inline && (
          <Card withBorder p="sm">
            <Group justify="space-between">
              <div>
                <Text size="sm" fw={500}>Response Deadline</Text>
                <Text size="xs" c="dimmed">
                  {new Date(deadlines.responseDeadline).toLocaleDateString()}
                </Text>
              </div>
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => {
                  editForm.setFieldValue('newDeadline', new Date(deadlines.responseDeadline));
                  setEditModalOpened(true);
                }}
              >
                <IconEdit size="0.8rem" />
              </ActionIcon>
            </Group>
          </Card>
        )}

        {/* Edit Deadline Modal */}
        <Modal
          opened={editModalOpened}
          onClose={() => setEditModalOpened(false)}
          title="Update Response Deadline"
          size="md"
        >
          <form onSubmit={editForm.onSubmit(updateDeadline)}>
            <Stack>
              <DateInput
                label="New Deadline Date"
                placeholder="Select new deadline"
                required
                minDate={new Date()}
                leftSection={<IconCalendar size="1rem" />}
                {...editForm.getInputProps('newDeadline')}
              />

              <Textarea
                label="Reason for Change (Optional)"
                placeholder="Explain why the deadline is being updated..."
                rows={3}
                {...editForm.getInputProps('reason')}
              />

              <Group justify="flex-end" mt="md">
                <Button
                  variant="subtle"
                  onClick={() => setEditModalOpened(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Deadline</Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    );
  }

  return null;
};

// Hook for deadline monitoring
export const useDeadlineAlerts = () => {
  const [summary, setSummary] = useState<DeadlineSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await api.get('/disputes/deadlines/summary');
      if (response.data.success) {
        setSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch deadline summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchSummary, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    summary,
    loading,
    refresh: fetchSummary,
    hasAlerts: summary ? (summary.overdue + summary.urgent + summary.warning > 0) : false,
    alertCount: summary ? (summary.overdue + summary.urgent + summary.warning) : 0,
  };
};