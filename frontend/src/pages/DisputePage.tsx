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
  Paper,
  Grid,
  Select,
  Progress,
  Alert,
  Code,
  Tabs,
  Timeline,
  ThemeIcon,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconAnalyze,
  IconFileText,
  IconCheck,
  IconDownload,
  IconClock,
  IconSend,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';

// Components
import AppLayout from '../components/AppLayout';
import { PreSubmissionValidation } from '../components/PreSubmissionValidation';
import { DeadlineAlerts } from '../components/DeadlineAlerts';
import api from '../utils/api';

interface Dispute {
  _id: string;
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  requestDetails: {
    requestedService: string;
    serviceCode?: string;
    diagnosisCode?: string;
    clinicalJustification: string;
    requestedDate: string;
  };
  denial: {
    denialDate: string;
    denialReason: string;
    denialCode?: string;
    denialDocument?: {
      filename: string;
      originalName: string;
    };
  };
  analysis?: {
    analysisDate: string;
    disputeOpportunities: Array<{
      category: string;
      strength: string;
      description: string;
      evidence: string[];
      recommendedAction: string;
    }>;
    successProbability: number;
    recommendedApproach: string;
    keyArguments: string[];
    supportingEvidence: string[];
  };
  dispute: {
    status: string;
    submittedDate?: string;
    generatedDocuments: Array<{
      type: string;
      content: string;
      generatedAt: string;
    }>;
  };
  timeline: Array<{
    action: string;
    date: string;
    notes?: string;
  }>;
}

const DisputePage = () => {
  const { disputeId } = useParams<{ disputeId: string }>();
  const navigate = useNavigate();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  
  // Add validation state
  const [canSubmit, setCanSubmit] = useState(false);

  const generateForm = useForm({
    initialValues: {
      documentType: '',
    },
  });

  useEffect(() => {
    if (disputeId) {
      fetchDispute();
    }
  }, [disputeId]);

  const fetchDispute = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/disputes/${disputeId}`);
      if (response.data.success) {
        setDispute(response.data.dispute);
      }
    } catch (error) {
      console.error('Failed to fetch dispute:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load dispute details',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Add validation completion handler
  const handleValidationComplete = (canSubmitResult: boolean) => {
    setCanSubmit(canSubmitResult);
  };

  // Add submit dispute function
  const handleSubmitDispute = async () => {
    if (!canSubmit) {
      notifications.show({
        title: 'Validation Required',
        message: 'Please run validation checks before submitting',
        color: 'orange',
      });
      return;
    }

    try {
      await handleStatusUpdate('submitted');
      notifications.show({
        title: 'Dispute Submitted',
        message: 'Your dispute has been submitted successfully',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Submission Failed',
        message: 'Failed to submit dispute',
        color: 'red',
      });
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      const response = await api.put(`/disputes/${disputeId}/status`, {
        status: newStatus,
      });
      
      if (response.data.success) {
        setDispute(prev => prev ? {
          ...prev,
          dispute: {
            ...prev.dispute,
            status: newStatus,
          },
        } : null);
      }
    } catch (error: any) {
      throw error;
    }
  };

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      const response = await api.post(`/disputes/${disputeId}/analyze`);
      
      if (response.data.success) {
        setDispute(prev => prev ? {
          ...prev,
          analysis: response.data.analysis,
        } : null);
        
        notifications.show({
          title: 'Analysis Complete',
          message: 'AI analysis has identified dispute opportunities',
          color: 'green',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Analysis Failed',
        message: error.response?.data?.message || 'Failed to analyze denial',
        color: 'red',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async (values: { documentType: string }) => {
    try {
      setGenerating(true);
      const response = await api.post(`/disputes/${disputeId}/generate`, {
        documentType: values.documentType,
      });
      
      if (response.data.success) {
        setDispute(prev => prev ? {
          ...prev,
          dispute: {
            ...prev.dispute,
            generatedDocuments: [...prev.dispute.generatedDocuments, response.data.document],
          },
        } : null);
        
        notifications.show({
          title: 'Document Generated',
          message: `${values.documentType} has been generated successfully`,
          color: 'green',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Generation Failed',
        message: error.response?.data?.message || 'Failed to generate document',
        color: 'red',
      });
    } finally {
      setGenerating(false);
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

  const getStrengthColor = (strength: string) => {
    const colors = {
      strong: 'green',
      moderate: 'yellow',
      weak: 'red',
    };
    return colors[strength as keyof typeof colors] || 'gray';
  };

  if (loading) {
    return (
      <AppLayout>
        <Container size="xl">
          <Text>Loading dispute details...</Text>
        </Container>
      </AppLayout>
    );
  }

  if (!dispute) {
    return (
      <AppLayout>
        <Container size="xl">
          <Text>Dispute not found</Text>
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
            <ActionIcon variant="subtle" onClick={() => navigate(-1)}>
              <IconArrowLeft size="1.2rem" />
            </ActionIcon>
            <div style={{ flex: 1 }}>
              <Group justify="space-between">
                <div>
                  <Title order={1}>Prior Authorization Dispute</Title>
                  <Text c="dimmed" size="lg" mt="xs">
                    {dispute.patient.firstName} {dispute.patient.lastName} - {dispute.requestDetails.requestedService}
                  </Text>
                </div>
                <Badge color={getStatusColor(dispute.dispute.status)} size="lg">
                  {dispute.dispute.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </Group>
            </div>
          </Group>

          {/* Add Deadline Alerts */}
          <DeadlineAlerts disputeId={disputeId} />

          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="validation">Validation</Tabs.Tab>
              <Tabs.Tab value="analysis">AI Analysis</Tabs.Tab>
              <Tabs.Tab value="documents">Generated Documents</Tabs.Tab>
              <Tabs.Tab value="timeline">Timeline</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="lg">
              <Grid>
                <Grid.Col span={{ base: 12, md: 8 }}>
                  <Stack>
                    {/* Request Details */}
                    <Paper p="lg" withBorder>
                      <Title order={3} mb="md">Request Details</Title>
                      <Grid>
                        <Grid.Col span={6}>
                          <Text size="sm" fw={500}>Requested Service:</Text>
                          <Text>{dispute.requestDetails.requestedService}</Text>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Text size="sm" fw={500}>Requested Date:</Text>
                          <Text>{new Date(dispute.requestDetails.requestedDate).toLocaleDateString()}</Text>
                        </Grid.Col>
                        {dispute.requestDetails.serviceCode && (
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500}>Service Code:</Text>
                            <Text>{dispute.requestDetails.serviceCode}</Text>
                          </Grid.Col>
                        )}
                        {dispute.requestDetails.diagnosisCode && (
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500}>Diagnosis Code:</Text>
                            <Text>{dispute.requestDetails.diagnosisCode}</Text>
                          </Grid.Col>
                        )}
                      </Grid>
                      <Text size="sm" fw={500} mt="md">Clinical Justification:</Text>
                      <Text>{dispute.requestDetails.clinicalJustification}</Text>
                    </Paper>

                    {/* Denial Details */}
                    <Paper p="lg" withBorder>
                      <Title order={3} mb="md">Denial Details</Title>
                      <Grid>
                        <Grid.Col span={6}>
                          <Text size="sm" fw={500}>Denial Date:</Text>
                          <Text>{new Date(dispute.denial.denialDate).toLocaleDateString()}</Text>
                        </Grid.Col>
                        {dispute.denial.denialCode && (
                          <Grid.Col span={6}>
                            <Text size="sm" fw={500}>Denial Code:</Text>
                            <Text>{dispute.denial.denialCode}</Text>
                          </Grid.Col>
                        )}
                      </Grid>
                      <Text size="sm" fw={500} mt="md">Denial Reason:</Text>
                      <Text>{dispute.denial.denialReason}</Text>
                      {dispute.denial.denialDocument && (
                        <Group mt="md">
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconDownload size="0.8rem" />}
                          >
                            Download Denial Letter
                          </Button>
                        </Group>
                      )}
                    </Paper>
                  </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Paper p="lg" withBorder>
                    <Title order={4} mb="md">Quick Actions</Title>
                    <Stack>
                      {!dispute.analysis ? (
                        <Button
                          fullWidth
                          leftSection={<IconAnalyze size="1rem" />}
                          loading={analyzing}
                          onClick={handleAnalyze}
                        >
                          Analyze Denial
                        </Button>
                      ) : (
                        <Alert color="green" icon={<IconCheck size="1rem" />}>
                          Analysis complete! Check the Analysis tab.
                        </Alert>
                      )}
                      
                      {dispute.analysis && (
                        <Select
                          label="Generate Document"
                          placeholder="Choose document type"
                          data={[
                            { value: 'email', label: 'Email to Insurance' },
                            { value: 'letter', label: 'Formal Appeal Letter' },
                            { value: 'phone_notes', label: 'Phone Call Script' },
                            { value: 'peer_review', label: 'Peer Review Notes' },
                          ]}
                          {...generateForm.getInputProps('documentType')}
                        />
                      )}
                      
                      {dispute.analysis && generateForm.values.documentType && (
                        <Button
                          fullWidth
                          leftSection={<IconFileText size="1rem" />}
                          loading={generating}
                          onClick={() => handleGenerate(generateForm.values)}
                        >
                          Generate Document
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Tabs.Panel>

            {/* Add Validation Tab */}
            <Tabs.Panel value="validation" pt="lg">
              <Grid>
                <Grid.Col span={{ base: 12, md: 8 }}>
                  <PreSubmissionValidation
                    disputeId={disputeId!}
                    onValidationComplete={handleValidationComplete}
                    autoValidate={dispute.dispute.status === 'pending'}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Stack>
                    <Paper p="lg" withBorder>
                      <Title order={4} mb="md">Validation Status</Title>
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Text size="sm">Can Submit:</Text>
                          <Badge color={canSubmit ? 'green' : 'red'}>
                            {canSubmit ? 'Ready' : 'Not Ready'}
                          </Badge>
                        </Group>
                        
                        {canSubmit && dispute.dispute.status !== 'submitted' && (
                          <Button
                            fullWidth
                            leftSection={<IconSend size="1rem" />}
                            onClick={handleSubmitDispute}
                            color="green"
                          >
                            Submit Dispute
                          </Button>
                        )}
                        
                        {!canSubmit && (
                          <Alert color="orange" p="sm">
                            <Text size="sm">
                              Please resolve validation issues before submitting
                            </Text>
                          </Alert>
                        )}
                      </Stack>
                    </Paper>

                    <DeadlineAlerts disputeId={disputeId} inline />
                  </Stack>
                </Grid.Col>
              </Grid>
            </Tabs.Panel>

            <Tabs.Panel value="analysis" pt="lg">
              {!dispute.analysis ? (
                <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                  <ThemeIcon size="xl" variant="light" color="blue" mx="auto" mb="md">
                    <IconAnalyze size="2rem" />
                  </ThemeIcon>
                  <Text size="lg" fw={500} mb="xs">
                    AI Analysis Not Yet Performed
                  </Text>
                  <Text c="dimmed" mb="md">
                    Run AI analysis to identify dispute opportunities and get strategic recommendations
                  </Text>
                  <Button
                    leftSection={<IconAnalyze size="1rem" />}
                    loading={analyzing}
                    onClick={handleAnalyze}
                  >
                    Analyze Denial
                  </Button>
                </Paper>
              ) : (
                <Stack>
                  {/* Success Probability */}
                  <Paper p="lg" withBorder>
                    <Group justify="space-between" mb="md">
                      <Title order={3}>Success Probability</Title>
                      <Badge size="lg" color={
                        dispute.analysis.successProbability >= 70 ? 'green' :
                        dispute.analysis.successProbability >= 40 ? 'yellow' : 'red'
                      }>
                        {dispute.analysis.successProbability}%
                      </Badge>
                    </Group>
                    <Progress
                      value={dispute.analysis.successProbability}
                      color={
                        dispute.analysis.successProbability >= 70 ? 'green' :
                        dispute.analysis.successProbability >= 40 ? 'yellow' : 'red'
                      }
                      size="lg"
                    />
                    <Text size="sm" c="dimmed" mt="xs">
                      Recommended Approach: <strong>{dispute.analysis.recommendedApproach.replace('_', ' ')}</strong>
                    </Text>
                  </Paper>

                  {/* Dispute Opportunities */}
                  <Paper p="lg" withBorder>
                    <Title order={3} mb="md">Dispute Opportunities</Title>
                    <Stack>
                      {dispute.analysis.disputeOpportunities.map((opportunity, index) => (
                        <Card key={index} withBorder>
                          <Group justify="space-between" mb="xs">
                            <Text fw={500}>{opportunity.category.replace('_', ' ').toUpperCase()}</Text>
                            <Badge color={getStrengthColor(opportunity.strength)}>
                              {opportunity.strength}
                            </Badge>
                          </Group>
                          <Text size="sm" mb="md">{opportunity.description}</Text>
                          <Text size="sm" fw={500} mb="xs">Recommended Action:</Text>
                          <Text size="sm" c="dimmed">{opportunity.recommendedAction}</Text>
                          {opportunity.evidence.length > 0 && (
                            <>
                              <Text size="sm" fw={500} mt="md" mb="xs">Evidence Needed:</Text>
                              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                                {opportunity.evidence.map((evidence, evidenceIndex) => (
                                  <li key={evidenceIndex}>
                                    <Text size="sm" c="dimmed">{evidence}</Text>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </Card>
                      ))}
                    </Stack>
                  </Paper>

                  {/* Key Arguments */}
                  <Grid>
                    <Grid.Col span={6}>
                      <Paper p="lg" withBorder>
                        <Title order={4} mb="md">Key Arguments</Title>
                        <Stack gap="xs">
                          {dispute.analysis.keyArguments.map((argument, index) => (
                            <Text key={index} size="sm">• {argument}</Text>
                          ))}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Paper p="lg" withBorder>
                        <Title order={4} mb="md">Supporting Evidence</Title>
                        <Stack gap="xs">
                          {dispute.analysis.supportingEvidence.map((evidence, index) => (
                            <Text key={index} size="sm">• {evidence}</Text>
                          ))}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  </Grid>
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="documents" pt="lg">
              {dispute.dispute.generatedDocuments.length === 0 ? (
                <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                  <ThemeIcon size="xl" variant="light" color="gray" mx="auto" mb="md">
                    <IconFileText size="2rem" />
                  </ThemeIcon>
                  <Text size="lg" fw={500} mb="xs">
                    No Documents Generated Yet
                  </Text>
                  <Text c="dimmed" mb="md">
                    Generate dispute documents using AI after running analysis
                  </Text>
                </Paper>
              ) : (
                <Stack>
                  {dispute.dispute.generatedDocuments.map((document, index) => (
                    <Paper key={index} p="lg" withBorder>
                      <Group justify="space-between" mb="md">
                        <div>
                          <Text fw={500} size="lg">
                            {document.type.replace('_', ' ').toUpperCase()}
                          </Text>
                          <Text size="sm" c="dimmed">
                            Generated on {new Date(document.generatedAt).toLocaleString()}
                          </Text>
                        </div>
                        <Group>
                          <Button size="xs" variant="light" leftSection={<IconDownload size="0.8rem" />}>
                            Download
                          </Button>
                          <Button size="xs" leftSection={<IconSend size="0.8rem" />}>
                            Send
                          </Button>
                        </Group>
                      </Group>
                      <Code block>{document.content}</Code>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="timeline" pt="lg">
              <Paper p="lg" withBorder>
                <Title order={3} mb="md">Dispute Timeline</Title>
                <Timeline active={dispute.timeline.length} bulletSize={24}>
                  {dispute.timeline.map((entry, index) => (
                    <Timeline.Item
                      key={index}
                      bullet={<IconClock size="0.8rem" />}
                      title={entry.action}
                    >
                      <Text size="sm" c="dimmed">
                        {new Date(entry.date).toLocaleString()}
                      </Text>
                      {entry.notes && (
                        <Text size="sm" mt="xs">{entry.notes}</Text>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Paper>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>
    </AppLayout>
  );
};

export default DisputePage;