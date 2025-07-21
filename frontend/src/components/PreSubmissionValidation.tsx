// components/PreSubmissionValidation.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Text,
  Button,
  Group,
  Progress,
  Alert,
  Badge,
  ThemeIcon,
  Collapse,
  ActionIcon,
  Loader,
  List,
  Title,
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconShieldCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import api from '../utils/api';

interface ValidationCheck {
  checkType: string;
  status: 'pending' | 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
  checkedAt: string;
}

interface ValidationResult {
  preSubmissionChecks: ValidationCheck[];
  overallValidationStatus: 'pending' | 'passed' | 'failed' | 'warning';
  canSubmit: boolean;
  lastValidated?: string;
}

interface PreSubmissionValidationProps {
  disputeId: string;
  onValidationComplete?: (canSubmit: boolean) => void;
  autoValidate?: boolean;
}

const checkTypeLabels: Record<string, string> = {
  cpt_code_validation: 'CPT/Service Code',
  icd_code_validation: 'ICD Diagnosis Code',
  patient_demographics: 'Patient Information',
  insurance_verification: 'Insurance Details',
  medical_necessity: 'Medical Necessity',
  documentation_completeness: 'Documentation',
  prior_authorization_history: 'Prior Authorization History',
};

const checkTypeDescriptions: Record<string, string> = {
  cpt_code_validation: 'Validates CPT/procedure codes for correct format and validity',
  icd_code_validation: 'Validates ICD-10 diagnosis codes for proper format',
  patient_demographics: 'Ensures all required patient information is complete',
  insurance_verification: 'Verifies insurance details and policy information',
  medical_necessity: 'Reviews clinical justification for medical necessity',
  documentation_completeness: 'Checks for required supporting documentation',
  prior_authorization_history: 'Reviews similar requests and potential conflicts',
};

export const PreSubmissionValidation: React.FC<PreSubmissionValidationProps> = ({
  disputeId,
  onValidationComplete,
  autoValidate = false,
}) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (autoValidate) {
      runValidation();
    } else {
      fetchValidationStatus();
    }
  }, [disputeId, autoValidate]);

  const fetchValidationStatus = async () => {
    try {
      const response = await api.get(`/disputes/${disputeId}/validation-status`);
      if (response.data.success) {
        setValidation(response.data.validation);
        onValidationComplete?.(response.data.validation?.canSubmit || false);
      }
    } catch (error) {
      console.error('Failed to fetch validation status:', error);
    }
  };

  const runValidation = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/disputes/${disputeId}/validate`);
      
      if (response.data.success) {
        setValidation(response.data.validation);
        onValidationComplete?.(response.data.validation?.canSubmit || false);
        
        notifications.show({
          title: 'Validation Complete',
          message: response.data.message,
          color: response.data.validation.overallValidationStatus === 'passed' ? 'green' : 
                 response.data.validation.overallValidationStatus === 'warning' ? 'yellow' : 'red',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Validation Failed',
        message: error.response?.data?.message || 'Failed to run validation',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <IconCheck size="1rem" color="green" />;
      case 'failed':
        return <IconX size="1rem" color="red" />;
      case 'warning':
        return <IconAlertTriangle size="1rem" color="orange" />;
      default:
        return <Loader size="sm" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'green';
      case 'failed':
        return 'red';
      case 'warning':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const toggleExpanded = (checkType: string) => {
    const newExpanded = new Set(expandedChecks);
    if (newExpanded.has(checkType)) {
      newExpanded.delete(checkType);
    } else {
      newExpanded.add(checkType);
    }
    setExpandedChecks(newExpanded);
  };

  const getProgressValue = () => {
    if (!validation?.preSubmissionChecks) return 0;
    const completed = validation.preSubmissionChecks.filter(check => 
      ['passed', 'failed', 'warning'].includes(check.status)
    ).length;
    return (completed / validation.preSubmissionChecks.length) * 100;
  };

  const renderCheckDetails = (check: ValidationCheck) => {
    const details = check.details;
    if (!details) return null;

    return (
      <Stack gap="xs" mt="sm">
        {details.issues && (
          <div>
            <Text size="sm" fw={500} c="red">Issues Found:</Text>
            <List size="sm">
              {details.issues.map((issue: string, index: number) => (
                <List.Item key={index}>{issue}</List.Item>
              ))}
            </List>
          </div>
        )}
        
        {details.warnings && (
          <div>
            <Text size="sm" fw={500} c="orange">Warnings:</Text>
            <List size="sm">
              {details.warnings.map((warning: string, index: number) => (
                <List.Item key={index}>{warning}</List.Item>
              ))}
            </List>
          </div>
        )}

        {details.suggestedAdditions && (
          <div>
            <Text size="sm" fw={500} c="blue">Suggestions:</Text>
            <List size="sm">
              {details.suggestedAdditions.map((suggestion: string, index: number) => (
                <List.Item key={index}>{suggestion}</List.Item>
              ))}
            </List>
          </div>
        )}

        {details.tip && (
          <Alert color="blue" p="sm">
            <Text size="sm">{details.tip}</Text>
          </Alert>
        )}

        {details.missingCode && (
          <Alert color="red" p="sm">
            <Text size="sm">This field is required for submission</Text>
          </Alert>
        )}

        {details.invalidFormat && (
          <Alert color="red" p="sm">
            <Text size="sm">
              Provided: <code>{details.providedCode}</code>
            </Text>
          </Alert>
        )}
      </Stack>
    );
  };

  if (!validation && !loading) {
    return (
      <Card withBorder>
        <Stack align="center" py="xl">
          <ThemeIcon size="xl" variant="light" color="blue">
            <IconShieldCheck size="2rem" />
          </ThemeIcon>
          <div style={{ textAlign: 'center' }}>
            <Title order={4}>Pre-submission Validation</Title>
            <Text c="dimmed" mt="xs">
              Run validation checks before submitting your dispute
            </Text>
          </div>
          <Button
            leftSection={<IconShieldCheck size="1rem" />}
            onClick={runValidation}
            loading={loading}
          >
            Run Validation Checks
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={4}>Pre-submission Validation</Title>
            <Text size="sm" c="dimmed">
              {validation?.lastValidated 
                ? `Last validated: ${new Date(validation.lastValidated).toLocaleString()}`
                : 'Validation pending'
              }
            </Text>
          </div>
          <Group>
            <Badge
              color={validation ? getStatusColor(validation.overallValidationStatus) : 'gray'}
              size="lg"
            >
              {validation?.overallValidationStatus?.toUpperCase() || 'PENDING'}
            </Badge>
            <ActionIcon
              variant="subtle"
              onClick={runValidation}
              loading={loading}
              disabled={loading}
            >
              <IconRefresh size="1rem" />
            </ActionIcon>
          </Group>
        </Group>

        {validation && (
          <>
            <Progress
              value={getProgressValue()}
              color={getStatusColor(validation.overallValidationStatus)}
              size="lg"
            />

            <Stack gap="xs">
              {validation.preSubmissionChecks.map((check, index) => (
                <Card key={check.checkType} withBorder p="sm">
                  <Group
                    justify="space-between"
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleExpanded(check.checkType)}
                  >
                    <Group>
                      <ThemeIcon
                        size="sm"
                        color={getStatusColor(check.status)}
                        variant={check.status === 'pending' ? 'light' : 'filled'}
                      >
                        {getStatusIcon(check.status)}
                      </ThemeIcon>
                      <div>
                        <Text fw={500} size="sm">
                          {checkTypeLabels[check.checkType] || check.checkType}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {checkTypeDescriptions[check.checkType]}
                        </Text>
                      </div>
                    </Group>
                    <Group>
                      <Badge
                        size="xs"
                        color={getStatusColor(check.status)}
                        variant="light"
                      >
                        {check.status}
                      </Badge>
                      <ActionIcon size="sm" variant="subtle">
                        {expandedChecks.has(check.checkType) ? (
                          <IconChevronUp size="0.8rem" />
                        ) : (
                          <IconChevronDown size="0.8rem" />
                        )}
                      </ActionIcon>
                    </Group>
                  </Group>

                  <Collapse in={expandedChecks.has(check.checkType)}>
                    <Stack mt="sm" gap="xs">
                      <Text size="sm">{check.message}</Text>
                      {renderCheckDetails(check)}
                    </Stack>
                  </Collapse>
                </Card>
              ))}
            </Stack>

            {validation.overallValidationStatus === 'failed' && (
              <Alert color="red" icon={<IconX size="1rem" />}>
                <Text fw={500}>Validation Failed</Text>
                <Text size="sm">
                  Please resolve the failed checks before submitting your dispute.
                </Text>
              </Alert>
            )}

            {validation.overallValidationStatus === 'warning' && (
              <Alert color="yellow" icon={<IconAlertTriangle size="1rem" />}>
                <Text fw={500}>Validation Warnings</Text>
                <Text size="sm">
                  You can proceed with submission, but addressing these warnings may improve your chances of success.
                </Text>
              </Alert>
            )}

            {validation.overallValidationStatus === 'passed' && (
              <Alert color="green" icon={<IconCheck size="1rem" />}>
                <Text fw={500}>Validation Passed</Text>
                <Text size="sm">
                  All checks have passed. Your dispute is ready for submission.
                </Text>
              </Alert>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
};