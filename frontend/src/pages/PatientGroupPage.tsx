import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Card,
  Badge,
  ActionIcon,
  Menu,
  Grid,
  Paper,
  ThemeIcon,
  SimpleGrid,
  Skeleton,
  Modal,
  TextInput,
  Select,
} from '@mantine/core';
import {
  IconPlus,
  IconDots,
  IconEdit,
  IconTrash,
  IconUserPlus,
  IconUser,
  IconFileText,
  IconArrowLeft,
  IconMail,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

// Components
import AppLayout from '../components/AppLayout';
import CreatePatientModal from '../pages/CreatePatientModal';

// Context
import { usePatientGroup } from '../context/PatientGroupContext';
import api from '../utils/api';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  insuranceInfo: {
    provider: string;
    policyNumber: string;
  };
  priorAuthorizations: any[];
  createdAt: string;
}

const PatientGroupPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { currentGroup, loading, fetchPatientGroup } = usePatientGroup();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [createPatientOpened, { open: openCreatePatient, close: closeCreatePatient }] = useDisclosure(false);
  const [inviteModalOpened, { open: openInviteModal, close: closeInviteModal }] = useDisclosure(false);

  const inviteForm = useForm({
    initialValues: {
      email: '',
      permission: 'view',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
    },
  });

  useEffect(() => {
    if (groupId) {
      fetchPatientGroup(groupId);
      fetchPatients();
    }
  }, [groupId]);

  const fetchPatients = async () => {
    try {
      setPatientsLoading(true);
      const response = await api.get(`/patients/group/${groupId}`);
      if (response.data.success) {
        setPatients(response.data.patients);
      }
    } catch (error) {
      console.error('Failed to fetch patients:', error);
    } finally {
      setPatientsLoading(false);
    }
  };

  const handleInviteMember = async (values: { email: string; permission: string }) => {
    try {
      await api.post(`/patient-groups/${groupId}/invite`, values);
      notifications.show({
        title: 'Invitation Sent',
        message: `Invitation sent to ${values.email}`,
        color: 'green',
      });
      inviteForm.reset();
      closeInviteModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to send invitation',
        color: 'red',
      });
    }
  };

  const handleCreatePatient = () => {
    fetchPatients();
    closeCreatePatient();
  };

  if (loading) {
    return (
      <AppLayout>
        <Container size="xl">
          <Stack gap="xl">
            <Skeleton height={60} />
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} height={200} />
              ))}
            </SimpleGrid>
          </Stack>
        </Container>
      </AppLayout>
    );
  }

  if (!currentGroup) {
    return (
      <AppLayout>
        <Container size="xl">
          <Text>Patient group not found</Text>
        </Container>
      </AppLayout>
    );
  }

  const userPermission = currentGroup.members?.find(
    member => member.user._id === 'current-user-id' // This should come from auth context
  )?.permission || 'view';

  return (
    <AppLayout>
      <Container size="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group>
            <ActionIcon variant="subtle" onClick={() => navigate('/dashboard')}>
              <IconArrowLeft size="1.2rem" />
            </ActionIcon>
            <div style={{ flex: 1 }}>
              <Group justify="space-between">
                <div>
                  <Title order={1}>{currentGroup.name}</Title>
                  <Text c="dimmed" size="lg" mt="xs">
                    {currentGroup.description || 'No description provided'}
                  </Text>
                </div>
                <Group>
                  {['edit', 'admin'].includes(userPermission) && (
                    <>
                      <Button 
                        leftSection={<IconUserPlus size="1rem" />}
                        variant="light"
                        onClick={openInviteModal}
                      >
                        Invite Member
                      </Button>
                      <Button 
                        leftSection={<IconPlus size="1rem" />}
                        onClick={openCreatePatient}
                      >
                        Add Patient
                      </Button>
                    </>
                  )}
                </Group>
              </Group>
            </div>
          </Group>

          {/* Group Info */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Paper p="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Title order={3}>Patients ({patients.length})</Title>
                  <Badge color="blue">{userPermission} access</Badge>
                </Group>

                {patientsLoading ? (
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} height={120} />
                    ))}
                  </SimpleGrid>
                ) : patients.length > 0 ? (
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    {patients.map((patient) => (
                      <Card
                        key={patient._id}
                        shadow="sm"
                        padding="md"
                        withBorder
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/patient/${patient._id}`)}
                      >
                        <Group justify="space-between" mb="xs">
                          <Group>
                            <ThemeIcon color="blue" variant="light">
                              <IconUser size="1rem" />
                            </ThemeIcon>
                            <div>
                              <Text fw={500}>
                                {patient.firstName} {patient.lastName}
                              </Text>
                              <Text size="sm" c="dimmed">
                                DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                              </Text>
                            </div>
                          </Group>
                          <Menu shadow="md" width={200}>
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
                                Edit Patient
                              </Menu.Item>
                              <Menu.Item leftSection={<IconFileText size="0.9rem" />}>
                                New Dispute
                              </Menu.Item>
                              {userPermission === 'admin' && (
                                <>
                                  <Menu.Divider />
                                  <Menu.Item
                                    color="red"
                                    leftSection={<IconTrash size="0.9rem" />}
                                  >
                                    Delete Patient
                                  </Menu.Item>
                                </>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        </Group>

                        <Stack gap="xs">
                          <Text size="sm">
                            <strong>Insurance:</strong> {patient.insuranceInfo.provider}
                          </Text>
                          <Text size="sm">
                            <strong>Policy:</strong> {patient.insuranceInfo.policyNumber}
                          </Text>
                          <Text size="sm">
                            <strong>Disputes:</strong> {patient.priorAuthorizations?.length || 0}
                          </Text>
                        </Stack>
                      </Card>
                    ))}
                  </SimpleGrid>
                ) : (
                  <Paper p="xl" radius="md" style={{ textAlign: 'center' }}>
                    <ThemeIcon size="xl" variant="light" color="gray" mx="auto" mb="md">
                      <IconUser size="2rem" />
                    </ThemeIcon>
                    <Text size="lg" fw={500} mb="xs">
                      No patients yet
                    </Text>
                    <Text c="dimmed" mb="md">
                      Add your first patient to start managing prior authorization disputes
                    </Text>
                    {['edit', 'admin'].includes(userPermission) && (
                      <Button leftSection={<IconPlus size="1rem" />} onClick={openCreatePatient}>
                        Add First Patient
                      </Button>
                    )}
                  </Paper>
                )}
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack>
                {/* Group Members */}
                <Paper p="md" withBorder>
                  <Title order={4} mb="md">
                    Members ({currentGroup.members?.length || 0})
                  </Title>
                  <Stack gap="xs">
                    {currentGroup.members?.map((member) => (
                      <Group key={member.user._id} justify="space-between">
                        <Group gap="xs">
                          <ThemeIcon size="sm" color="blue" variant="light">
                            <IconUser size="0.8rem" />
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={500}>
                              {member.user.firstName} {member.user.lastName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {member.user.email}
                            </Text>
                          </div>
                        </Group>
                        <Badge size="xs" color={
                          member.permission === 'admin' ? 'red' : 
                          member.permission === 'edit' ? 'blue' : 'gray'
                        }>
                          {member.permission}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Paper>

                {/* Group Stats */}
                <Paper p="md" withBorder>
                  <Title order={4} mb="md">Group Stats</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm">Created:</Text>
                      <Text size="sm" fw={500}>
                        {new Date(currentGroup.createdAt).toLocaleDateString()}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Owner:</Text>
                      <Text size="sm" fw={500}>
                        {currentGroup.owner.firstName} {currentGroup.owner.lastName}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Total Patients:</Text>
                      <Text size="sm" fw={500}>
                        {patients.length}
                      </Text>
                    </Group>
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>

          {/* Invite Member Modal */}
          <Modal
            opened={inviteModalOpened}
            onClose={closeInviteModal}
            title="Invite Member"
            centered
          >
            <form onSubmit={inviteForm.onSubmit(handleInviteMember)}>
              <Stack>
                <TextInput
                  label="Email Address"
                  placeholder="colleague@example.com"
                  required
                  leftSection={<IconMail size="1rem" />}
                  {...inviteForm.getInputProps('email')}
                />
                <Select
                  label="Permission Level"
                  data={[
                    { value: 'view', label: 'View Only - Can view patients and disputes' },
                    { value: 'edit', label: 'Edit - Can add/edit patients and create disputes' },
                  ]}
                  {...inviteForm.getInputProps('permission')}
                />
                <Group justify="flex-end" mt="md">
                  <Button variant="subtle" onClick={closeInviteModal}>
                    Cancel
                  </Button>
                  <Button type="submit">Send Invitation</Button>
                </Group>
              </Stack>
            </form>
          </Modal>

          {/* Create Patient Modal */}
          <CreatePatientModal
            opened={createPatientOpened}
            onClose={closeCreatePatient}
            groupId={groupId!}
            onSuccess={handleCreatePatient}
          />
        </Stack>
      </Container>
    </AppLayout>
  );
};

export default PatientGroupPage;