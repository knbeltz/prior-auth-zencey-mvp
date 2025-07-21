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
  Textarea,
  FileInput,
  Select,
  Tabs,
  Timeline,
  Avatar,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDots,
  IconEdit,
  IconTrash,
  IconFileText,
  IconPlus,
  IconUser,
  IconPhone,
  IconShieldCheck,
  IconNotes,
  IconDownload,
  IconUpload,
  IconFileUpload,

} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

// Components
import AppLayout from '../components/AppLayout';
import CreateDisputeModal from '../components/CreateDisputeModal.tsx';

// Utils
import api from '../utils/api';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  patientId?: string;
  insuranceInfo: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
    subscriberId?: string;
    planName?: string;
    effectiveDate?: string;
    expirationDate?: string;
  };
  contactInfo: {
    phone?: string;
    email?: string;
    address: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
  };
  medicalInfo: {
    diagnosis: Array<{
      code: string;
      description: string;
      date: string;
    }>;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      prescribedDate: string;
    }>;
    allergies: string[];
    primaryPhysician?: string;
  };
  documents: Array<{
    _id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedBy: {
      firstName: string;
      lastName: string;
    };
    uploadedAt: string;
    documentType: string;
    description?: string;
  }>;
  priorAuthorizations: Array<{
    _id: string;
    requestDetails: {
      requestedService: string;
      requestedDate: string;
    };
    denial: {
      denialDate: string;
      denialReason: string;
    };
    dispute: {
      status: string;
    };
    createdAt: string;
  }>;
  notes: Array<{
    _id: string;
    content: string;
    createdBy: {
      firstName: string;
      lastName: string;
    };
    createdAt: string;
  }>;
  patientGroup: {
    _id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

const PatientDetailsPage = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('details');
  
  // Modals
  const [createDisputeOpened, { open: openCreateDispute, close: closeCreateDispute }] = useDisclosure(false);
  const [addNoteOpened, { open: openAddNote, close: closeAddNote }] = useDisclosure(false);
  const [uploadDocOpened, { open: openUploadDoc, close: closeUploadDoc }] = useDisclosure(false);

  // Forms
  const noteForm = useForm({
    initialValues: { content: '' },
    validate: {
      content: (value) => (value.trim().length < 5 ? 'Note must be at least 5 characters' : null),
    },
  });

  const uploadForm = useForm({
    initialValues: {
      document: null as File | null,
      documentType: 'other',
      description: '',
    },
  });

  useEffect(() => {
    if (patientId) {
      fetchPatient();
    }
  }, [patientId]);

  const fetchPatient = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/patients/${patientId}`);
      if (response.data.success) {
        setPatient(response.data.patient);
      }
    } catch (error) {
      console.error('Failed to fetch patient:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load patient details',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (values: { content: string }) => {
    try {
      const response = await api.post(`/patients/${patientId}/notes`, values);
      if (response.data.success) {
        setPatient(prev => prev ? {
          ...prev,
          notes: [...prev.notes, response.data.note],
        } : null);
        noteForm.reset();
        closeAddNote();
        notifications.show({
          title: 'Success',
          message: 'Note added successfully',
          color: 'green',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to add note',
        color: 'red',
      });
    }
  };

  const handleUploadDocument = async (values: { document: File | null; documentType: string; description: string }) => {
    if (!values.document) return;

    try {
      const formData = new FormData();
      formData.append('document', values.document);
      formData.append('documentType', values.documentType);
      formData.append('description', values.description);

      const response = await api.post(`/patients/${patientId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        await fetchPatient(); // Refresh patient data
        uploadForm.reset();
        closeUploadDoc();
        notifications.show({
          title: 'Success',
          message: 'Document uploaded successfully',
          color: 'green',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to upload document',
        color: 'red',
      });
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'gray',
      in_progress: 'blue',
      submitted: 'orange',
      under_review: 'yellow',
      approved: 'green',
      denied: 'red',
      withdrawn: 'gray',
    };
    return colors[status as keyof typeof colors] || 'gray';
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  if (loading) {
    return (
      <AppLayout>
        <Container size="xl">
          <Stack gap="xl">
            <Skeleton height={60} />
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
              <Skeleton height={300} />
              <Skeleton height={300} />
            </SimpleGrid>
          </Stack>
        </Container>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <Container size="xl">
          <Text>Patient not found</Text>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Container size="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group>
            <ActionIcon variant="subtle" onClick={() => navigate(`/group/${patient.patientGroup._id}`)}>
              <IconArrowLeft size="1.2rem" />
            </ActionIcon>
            <div style={{ flex: 1 }}>
              <Group justify="space-between">
                <Group>
                  <Avatar size="lg" color="blue">
                    {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
                  </Avatar>
                  <div>
                    <Title order={1}>
                      {patient.firstName} {patient.lastName}
                    </Title>
                    <Text c="dimmed" size="lg">
                      {calculateAge(patient.dateOfBirth)} years old • {patient.patientGroup.name}
                    </Text>
                  </div>
                </Group>
                <Group>
                  <Button 
                    leftSection={<IconFileText size="1rem" />}
                    onClick={openCreateDispute}
                  >
                    New Dispute
                  </Button>
                  <Menu shadow="md" width={200}>
                    <Menu.Target>
                      <ActionIcon variant="subtle">
                        <IconDots size="1.2rem" />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconEdit size="0.9rem" />}>
                        Edit Patient
                      </Menu.Item>
                      <Menu.Item leftSection={<IconUpload size="0.9rem" />} onClick={openUploadDoc}>
                        Upload Document
                      </Menu.Item>
                      <Menu.Item leftSection={<IconNotes size="0.9rem" />} onClick={openAddNote}>
                        Add Note
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item color="red" leftSection={<IconTrash size="0.9rem" />}>
                        Delete Patient
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>
            </div>
          </Group>

          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="disputes">
                Disputes ({patient.priorAuthorizations.length})
              </Tabs.Tab>
              <Tabs.Tab value="documents">
                Documents ({patient.documents.length})
              </Tabs.Tab>
              <Tabs.Tab value="notes">
                Notes ({patient.notes.length})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="lg">
              <Grid>
                <Grid.Col span={{ base: 12, lg: 8 }}>
                  <Stack>
                    {/* Personal Information */}
                    <Paper p="lg" withBorder>
                      <Group mb="md">
                        <ThemeIcon color="blue" variant="light">
                          <IconUser size="1.2rem" />
                        </ThemeIcon>
                        <Title order={3}>Personal Information</Title>
                      </Group>
                      <Grid>
                        <Grid.Col span={6}>
                          <Text size="sm" fw={500}>Date of Birth:</Text>
                          <Text>{new Date(patient.dateOfBirth).toLocaleDateString()}</Text>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Text size="sm" fw={500}>Gender:</Text>
                          <Text>{patient.gender || 'Not specified'}</Text>
                        </Grid.Col>
                        {patient.patientId && (
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500}>Patient ID:</Text>
                            <Text>{patient.patientId}</Text>
                          </Grid.Col>
                        )}
                      </Grid>
                    </Paper>

                    {/* Contact Information */}
                    <Paper p="lg" withBorder>
                      <Group mb="md">
                        <ThemeIcon color="green" variant="light">
                          <IconPhone size="1.2rem" />
                        </ThemeIcon>
                        <Title order={3}>Contact Information</Title>
                      </Group>
                      <Grid>
                        {patient.contactInfo.phone && (
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500}>Phone:</Text>
                            <Text>{patient.contactInfo.phone}</Text>
                          </Grid.Col>
                        )}
                        {patient.contactInfo.email && (
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500}>Email:</Text>
                            <Text>{patient.contactInfo.email}</Text>
                          </Grid.Col>
                        )}
                      </Grid>
                      {patient.contactInfo.address && (
                        <div>
                          <Text size="sm" fw={500} mt="md">Address:</Text>
                          <Text>
                            {[
                              patient.contactInfo.address.street,
                              patient.contactInfo.address.city,
                              patient.contactInfo.address.state,
                              patient.contactInfo.address.zipCode,
                            ].filter(Boolean).join(', ') || 'Not provided'}
                          </Text>
                        </div>
                      )}
                    </Paper>

                    {/* Insurance Information */}
                    <Paper p="lg" withBorder>
                      <Group mb="md">
                        <ThemeIcon color="orange" variant="light">
                          <IconShieldCheck size="1.2rem" />
                        </ThemeIcon>
                        <Title order={3}>Insurance Information</Title>
                      </Group>
                      <Grid>
                        <Grid.Col span={6}>
                          <Text size="sm" fw={500}>Provider:</Text>
                          <Text>{patient.insuranceInfo.provider}</Text>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Text size="sm" fw={500}>Policy Number:</Text>
                          <Text>{patient.insuranceInfo.policyNumber}</Text>
                        </Grid.Col>
                        {patient.insuranceInfo.groupNumber && (
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500}>Group Number:</Text>
                            <Text>{patient.insuranceInfo.groupNumber}</Text>
                          </Grid.Col>
                        )}
                        {patient.insuranceInfo.subscriberId && (
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500}>Subscriber ID:</Text>
                            <Text>{patient.insuranceInfo.subscriberId}</Text>
                          </Grid.Col>
                        )}
                        {patient.insuranceInfo.planName && (
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500}>Plan Name:</Text>
                            <Text>{patient.insuranceInfo.planName}</Text>
                          </Grid.Col>
                        )}
                      </Grid>
                    </Paper>
                  </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, lg: 4 }}>
                  <Stack>
                    {/* Quick Stats */}
                    <Paper p="lg" withBorder>
                      <Title order={4} mb="md">Quick Stats</Title>
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Text size="sm">Total Disputes:</Text>
                          <Badge>{patient.priorAuthorizations.length}</Badge>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Documents:</Text>
                          <Badge color="blue">{patient.documents.length}</Badge>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Notes:</Text>
                          <Badge color="green">{patient.notes.length}</Badge>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Allergies:</Text>
                          <Badge color="red">{patient.medicalInfo.allergies.length}</Badge>
                        </Group>
                      </Stack>
                    </Paper>

                    {/* Recent Activity */}
                    <Paper p="lg" withBorder>
                      <Title order={4} mb="md">Recent Activity</Title>
                      <Timeline bulletSize={16}>
                        {patient.priorAuthorizations.slice(0, 3).map((dispute) => (
                          <Timeline.Item key={dispute._id} bullet={<IconFileText size="0.6rem" />}>
                            <Text size="sm">{dispute.requestDetails.requestedService}</Text>
                            <Text size="xs" c="dimmed">
                              {new Date(dispute.createdAt).toLocaleDateString()}
                            </Text>
                          </Timeline.Item>
                        ))}
                        {patient.notes.slice(0, 2).map((note) => (
                          <Timeline.Item key={note._id} bullet={<IconNotes size="0.6rem" />}>
                            <Text size="sm">Note added</Text>
                            <Text size="xs" c="dimmed">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </Text>
                          </Timeline.Item>
                        ))}
                      </Timeline>
                    </Paper>
                  </Stack>
                </Grid.Col>
              </Grid>
            </Tabs.Panel>

            <Tabs.Panel value="disputes" pt="lg">
              {patient.priorAuthorizations.length === 0 ? (
                <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                  <ThemeIcon size="xl" variant="light" color="gray" mx="auto" mb="md">
                    <IconFileText size="2rem" />
                  </ThemeIcon>
                  <Text size="lg" fw={500} mb="xs">
                    No Disputes Yet
                  </Text>
                  <Text c="dimmed" mb="md">
                    Create your first prior authorization dispute for this patient
                  </Text>
                  <Button leftSection={<IconPlus size="1rem" />} onClick={openCreateDispute}>
                    Create First Dispute
                  </Button>
                </Paper>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                  {patient.priorAuthorizations.map((dispute) => (
                    <Card
                      key={dispute._id}
                      shadow="sm"
                      padding="lg"
                      withBorder
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/dispute/${dispute._id}`)}
                    >
                      <Group justify="space-between" mb="md">
                        <Text fw={500}>{dispute.requestDetails.requestedService}</Text>
                        <Badge color={getStatusColor(dispute.dispute.status)}>
                          {dispute.dispute.status.replace('_', ' ')}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed" mb="sm">
                        Requested: {new Date(dispute.requestDetails.requestedDate).toLocaleDateString()}
                      </Text>
                      <Text size="sm" c="dimmed" mb="sm">
                        Denied: {new Date(dispute.denial.denialDate).toLocaleDateString()}
                      </Text>
                      <Text size="sm" lineClamp={2}>
                        {dispute.denial.denialReason}
                      </Text>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="documents" pt="lg">
              {patient.documents.length === 0 ? (
                <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                  <ThemeIcon size="xl" variant="light" color="gray" mx="auto" mb="md">
                    <IconFileUpload size="2rem" />
                  </ThemeIcon>
                  <Text size="lg" fw={500} mb="xs">
                    No Documents Uploaded
                  </Text>
                  <Text c="dimmed" mb="md">
                    Upload patient documents like EHR, insurance cards, or medical records
                  </Text>
                  <Button leftSection={<IconUpload size="1rem" />} onClick={openUploadDoc}>
                    Upload Document
                  </Button>
                </Paper>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
                  {patient.documents.map((document) => (
                    <Card key={document._id} shadow="sm" padding="md" withBorder>
                      <Group justify="space-between" mb="xs">
                        <ThemeIcon color="blue" variant="light">
                          <IconFileText size="1rem" />
                        </ThemeIcon>
                        <Badge size="xs">{document.documentType}</Badge>
                      </Group>
                      <Text fw={500} size="sm" lineClamp={1} mb="xs">
                        {document.originalName}
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        {(document.size / 1024 / 1024).toFixed(2)} MB
                      </Text>
                      <Text size="xs" c="dimmed" mb="md">
                        Uploaded by {document.uploadedBy.firstName} {document.uploadedBy.lastName}
                      </Text>
                      <Button size="xs" variant="light" leftSection={<IconDownload size="0.8rem" />} fullWidth>
                        Download
                      </Button>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="notes" pt="lg">
              <Stack>
                <Group justify="space-between">
                  <Title order={3}>Patient Notes</Title>
                  <Button size="sm" leftSection={<IconPlus size="1rem" />} onClick={openAddNote}>
                    Add Note
                  </Button>
                </Group>
                
                {patient.notes.length === 0 ? (
                  <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                    <ThemeIcon size="xl" variant="light" color="gray" mx="auto" mb="md">
                      <IconNotes size="2rem" />
                    </ThemeIcon>
                    <Text size="lg" fw={500} mb="xs">
                      No Notes Yet
                    </Text>
                    <Text c="dimmed" mb="md">
                      Add notes about this patient's care or treatment
                    </Text>
                    <Button leftSection={<IconPlus size="1rem" />} onClick={openAddNote}>
                      Add First Note
                    </Button>
                  </Paper>
                ) : (
                  <Stack>
                    {patient.notes.map((note) => (
                      <Paper key={note._id} p="md" withBorder>
                        <Group justify="space-between" mb="xs">
                          <Group>
                            <Avatar size="sm" color="blue">
                              {note.createdBy.firstName.charAt(0)}
                            </Avatar>
                            <div>
                              <Text size="sm" fw={500}>
                                {note.createdBy.firstName} {note.createdBy.lastName}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {new Date(note.createdAt).toLocaleString()}
                              </Text>
                            </div>
                          </Group>
                        </Group>
                        <Text size="sm" mt="xs">
                          {note.content}
                        </Text>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Tabs.Panel>
          </Tabs>

          {/* Modals */}
          <Modal opened={addNoteOpened} onClose={closeAddNote} title="Add Patient Note">
            <form onSubmit={noteForm.onSubmit(handleAddNote)}>
              <Stack>
                <Textarea
                  label="Note Content"
                  placeholder="Enter your note about this patient..."
                  required
                  rows={4}
                  {...noteForm.getInputProps('content')}
                />
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={closeAddNote}>Cancel</Button>
                  <Button type="submit">Add Note</Button>
                </Group>
              </Stack>
            </form>
          </Modal>

          <Modal opened={uploadDocOpened} onClose={closeUploadDoc} title="Upload Document">
            <form onSubmit={uploadForm.onSubmit(handleUploadDocument)}>
              <Stack>
                <FileInput
                  label="Document"
                  placeholder="Select file to upload"
                  required
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  leftSection={<IconFileUpload size="1rem" />}
                  {...uploadForm.getInputProps('document')}
                />
                <Select
                  label="Document Type"
                  data={[
                    { value: 'ehr', label: 'Electronic Health Record' },
                    { value: 'insurance', label: 'Insurance Card/Document' },
                    { value: 'lab_results', label: 'Lab Results' },
                    { value: 'imaging', label: 'Imaging/X-rays' },
                    { value: 'referral', label: 'Referral Letter' },
                    { value: 'other', label: 'Other' },
                  ]}
                  {...uploadForm.getInputProps('documentType')}
                />
                <Textarea
                  label="Description (Optional)"
                  placeholder="Brief description of the document"
                  rows={2}
                  {...uploadForm.getInputProps('description')}
                />
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={closeUploadDoc}>Cancel</Button>
                  <Button type="submit">Upload Document</Button>
                </Group>
              </Stack>
            </form>
          </Modal>

          <CreateDisputeModal
            opened={createDisputeOpened}
            onClose={closeCreateDispute}
            patient={patient}
            onSuccess={() => {
              closeCreateDispute();
              fetchPatient();
            }}
          />
        </Stack>
      </Container>
    </AppLayout>
  );
};

export default PatientDetailsPage;