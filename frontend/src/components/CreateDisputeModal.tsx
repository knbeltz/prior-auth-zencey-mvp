import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  Button,
  Stack,
  Group,
  Text,
  Stepper,
  Select,
  FileInput,
  Grid,
  Paper,
  Alert,
  Loader,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { DateInput } from '@mantine/dates';
import {
  IconFileText,
  IconX,
  IconAlertCircle,
  IconUpload,
  IconCalendar,
  IconStethoscope,
  IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import api from '../utils/api';

interface CreateDisputeModalProps {
  opened: boolean;
  onClose: () => void;
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
    patientGroup: {
      _id: string;
    };
  };
  onSuccess?: () => void;
}

interface DisputeFormData {
  requestedService: string;
  serviceCode: string;
  diagnosisCode: string;
  requestedDate: Date | null;
  urgency: string;
  clinicalJustification: string;
  denialDate: Date | null;
  denialReason: string;
  denialCode: string;
  denialType: string;
  insuranceReviewer: string;
  denialDocument: File | null;
}

interface CodeValidationResult {
  cptValidation?: {
    status: 'passed' | 'failed' | 'warning';
    message: string;
    details?: any;
  };
  icdValidation?: {
    status: 'passed' | 'failed' | 'warning';
    message: string;
    details?: any;
  };
}

const CreateDisputeModal = ({ opened, onClose, patient, onSuccess }: CreateDisputeModalProps) => {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  
  // Add validation state
  const [codeValidation, setCodeValidation] = useState<CodeValidationResult>({});
  const [validatingCodes, setValidatingCodes] = useState(false);

  const form = useForm<DisputeFormData>({
    initialValues: {
      requestedService: '',
      serviceCode: '',
      diagnosisCode: '',
      requestedDate: null,
      urgency: 'routine',
      clinicalJustification: '',
      denialDate: null,
      denialReason: '',
      denialCode: '',
      denialType: 'other',
      insuranceReviewer: '',
      denialDocument: null,
    },
    validate: {
      requestedService: (value) => (value.trim().length < 3 ? 'Service name must be at least 3 characters' : null),
      requestedDate: (value) => (!value ? 'Requested date is required' : null),
      clinicalJustification: (value) => (value.trim().length < 10 ? 'Clinical justification must be at least 10 characters' : null),
      denialDate: (value) => (!value ? 'Denial date is required' : null),
      denialReason: (value) => (value.trim().length < 5 ? 'Denial reason must be at least 5 characters' : null),
    },
  });

  // Add code validation function
  const validateCodes = async (cptCode?: string, icdCode?: string) => {
    if (!cptCode && !icdCode) return;

    try {
      setValidatingCodes(true);
      const response = await api.post('/disputes/validate-codes', {
        cptCode,
        icdCode,
      });

      if (response.data.success) {
        setCodeValidation(response.data.results);
      }
    } catch (error) {
      console.error('Code validation error:', error);
    } finally {
      setValidatingCodes(false);
    }
  };

  // Add useEffect for real-time validation
  useEffect(() => {
    const serviceCode = form.values.serviceCode?.trim();
    const diagnosisCode = form.values.diagnosisCode?.trim();

    if (serviceCode && serviceCode.length >= 5) {
      const timeoutId = setTimeout(() => {
        validateCodes(serviceCode, diagnosisCode);
      }, 500); // Debounce validation

      return () => clearTimeout(timeoutId);
    }
  }, [form.values.serviceCode, form.values.diagnosisCode]);

  // Add validation indicator component
  const ValidationIndicator = ({ validation, type }: { validation?: any, type: string }) => {
    if (!validation) return null;

    const getColor = (status: string) => {
      switch (status) {
        case 'passed': return 'green';
        case 'failed': return 'red';
        case 'warning': return 'yellow';
        default: return 'gray';
      }
    };

    const getIcon = (status: string) => {
      switch (status) {
        case 'passed': return <IconCheck size="0.8rem" />;
        case 'failed': return <IconX size="0.8rem" />;
        case 'warning': return <IconAlertCircle size="0.8rem" />;
        default: return null;
      }
    };

    return (
      <Alert 
        color={getColor(validation.status)} 
        p="sm" 
        mt="xs"
        icon={getIcon(validation.status)}
      >
        <Text size="sm">{validation.message}</Text>
        {validation.details?.invalidFormat && (
          <Text size="xs" c="dimmed" mt="xs">
            Expected format: {type === 'cpt' ? '5 digits (e.g., 99213)' : 'Letter + digits (e.g., M79.9)'}
          </Text>
        )}
      </Alert>
    );
  };

  const handleSubmit = async (values: DisputeFormData) => {
    try {
      setLoading(true);

      // Create FormData for file upload
      const formData = new FormData();
      
      // Calculate response deadline (30 days from denial date for standard appeals)
      const denialDate = new Date(values.denialDate!);
      const responseDeadline = new Date(denialDate.getTime() + (30 * 24 * 60 * 60 * 1000));
      
      // Add dispute data
      formData.append('patientId', patient._id);
      formData.append('requestDetails', JSON.stringify({
        requestedService: values.requestedService.trim(),
        serviceCode: values.serviceCode.trim(),
        diagnosisCode: values.diagnosisCode.trim(),
        requestedDate: values.requestedDate,
        urgency: values.urgency,
        clinicalJustification: values.clinicalJustification.trim(),
      }));
      
      formData.append('denial', JSON.stringify({
        denialDate: values.denialDate,
        denialReason: values.denialReason.trim(),
        denialCode: values.denialCode.trim(),
        denialType: values.denialType,
        insuranceReviewer: values.insuranceReviewer.trim(),
      }));

      // Add calculated deadline
      formData.append('deadlines', JSON.stringify({
        responseDeadline: responseDeadline.toISOString(),
      }));

      // Add denial document if provided
      if (values.denialDocument) {
        formData.append('denialDocument', values.denialDocument);
      }

      const response = await api.post('/disputes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        notifications.show({
          title: 'Success',
          message: `Prior authorization dispute created successfully. Response deadline: ${responseDeadline.toLocaleDateString()}`,
          color: 'green',
        });
        
        form.reset();
        setActiveStep(0);
        setCodeValidation({});
        onSuccess?.();
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to create dispute',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setActiveStep(0);
    setCodeValidation({});
    onClose();
  };

  // Add validation summary before submission
  const canProceedToNext = () => {
    if (activeStep === 0) {
      // Check if codes are valid for step 1
      const hasErrors = codeValidation.cptValidation?.status === 'failed' || 
                       codeValidation.icdValidation?.status === 'failed';
      return !hasErrors;
    }
    return true;
  };

  const nextStep = () => {
    if (canProceedToNext()) {
      setActiveStep((current) => Math.min(current + 1, 2));
    } else {
      notifications.show({
        title: 'Validation Required',
        message: 'Please fix the validation errors before proceeding',
        color: 'orange',
      });
    }
  };

  const prevStep = () => setActiveStep((current) => Math.max(current - 1, 0));

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`Create Dispute for ${patient.firstName} ${patient.lastName}`}
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stepper active={activeStep} onStepClick={setActiveStep}>
          <Stepper.Step 
            label="Request Details" 
            description="Prior authorization request information"
            icon={<IconStethoscope size="1rem" />}
          >
            <Stack mt="md">
              <Alert color="blue" icon={<IconAlertCircle size="1rem" />}>
                Enter details about the original prior authorization request that was denied.
              </Alert>
              
              <TextInput
                label="Requested Service/Procedure"
                placeholder="e.g., MRI Brain with contrast"
                required
                {...form.getInputProps('requestedService')}
              />
              
              <Grid>
                <Grid.Col span={6}>
                  <div>
                    <TextInput
                      label="Service Code (CPT)"
                      placeholder="e.g., 70553"
                      rightSection={validatingCodes ? <Loader size="xs" /> : null}
                      {...form.getInputProps('serviceCode')}
                    />
                    <ValidationIndicator validation={codeValidation.cptValidation} type="cpt" />
                  </div>
                </Grid.Col>
                <Grid.Col span={6}>
                  <div>
                    <TextInput
                      label="Diagnosis Code (ICD-10)"
                      placeholder="e.g., G93.1"
                      rightSection={validatingCodes ? <Loader size="xs" /> : null}
                      {...form.getInputProps('diagnosisCode')}
                    />
                    <ValidationIndicator validation={codeValidation.icdValidation} type="icd" />
                  </div>
                </Grid.Col>
              </Grid>

              <Grid>
                <Grid.Col span={6}>
                  <DateInput
                    label="Requested Date"
                    placeholder="When was this requested?"
                    required
                    leftSection={<IconCalendar size="1rem" />}
                    maxDate={new Date()}
                    {...form.getInputProps('requestedDate')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Urgency Level"
                    data={[
                      { value: 'routine', label: 'Routine' },
                      { value: 'urgent', label: 'Urgent' },
                      { value: 'emergent', label: 'Emergent' },
                    ]}
                    {...form.getInputProps('urgency')}
                  />
                </Grid.Col>
              </Grid>

              <div>
                <Textarea
                  label="Clinical Justification"
                  placeholder="Provide detailed clinical justification for this service/procedure..."
                  required
                  rows={4}
                  {...form.getInputProps('clinicalJustification')}
                />
                <Group justify="space-between" mt="xs">
                  <Text size="xs" c="dimmed">
                    Minimum 50 characters recommended for medical necessity
                  </Text>
                  <Text size="xs" c={form.values.clinicalJustification.length >= 50 ? 'green' : 'orange'}>
                    {form.values.clinicalJustification.length} characters
                  </Text>
                </Group>
                {form.values.clinicalJustification.length > 0 && form.values.clinicalJustification.length < 50 && (
                  <Alert color="orange" p="sm" mt="xs">
                    <Text size="sm">
                      Consider adding more detail about patient symptoms, treatment rationale, and expected outcomes
                    </Text>
                  </Alert>
                )}
              </div>
            </Stack>
          </Stepper.Step>

          <Stepper.Step 
            label="Denial Details" 
            description="Information about the denial"
            icon={<IconFileText size="1rem" />}
          >
            <Stack mt="md">
              <Alert color="orange" icon={<IconAlertCircle size="1rem" />}>
                Enter details from the denial letter or notification you received.
              </Alert>

              <Grid>
                <Grid.Col span={6}>
                  <DateInput
                    label="Denial Date"
                    placeholder="When was this denied?"
                    required
                    leftSection={<IconCalendar size="1rem" />}
                    maxDate={new Date()}
                    {...form.getInputProps('denialDate')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Denial Code"
                    placeholder="e.g., D001, if provided"
                    {...form.getInputProps('denialCode')}
                  />
                </Grid.Col>
              </Grid>

              <Select
                label="Denial Type"
                data={[
                  { value: 'medical_necessity', label: 'Medical Necessity' },
                  { value: 'experimental', label: 'Experimental/Investigational' },
                  { value: 'not_covered', label: 'Service Not Covered' },
                  { value: 'documentation', label: 'Insufficient Documentation' },
                  { value: 'other', label: 'Other' },
                ]}
                {...form.getInputProps('denialType')}
              />

              <Textarea
                label="Denial Reason"
                placeholder="Copy the exact denial reason from the letter..."
                required
                rows={4}
                {...form.getInputProps('denialReason')}
              />

              <TextInput
                label="Insurance Reviewer (Optional)"
                placeholder="Name of the reviewing physician/staff"
                {...form.getInputProps('insuranceReviewer')}
              />
            </Stack>
          </Stepper.Step>

          <Stepper.Step 
            label="Upload Documents" 
            description="Denial letter and supporting documents"
            icon={<IconUpload size="1rem" />}
          >
            <Stack mt="md">
              <Alert color="green" icon={<IconAlertCircle size="1rem" />}>
                Upload the denial letter to enable AI analysis. Additional documents are optional.
              </Alert>

              <FileInput
                label="Denial Letter/Document"
                placeholder="Select the denial letter file"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                leftSection={<IconUpload size="1rem" />}
                {...form.getInputProps('denialDocument')}
              />
              
              {form.values.denialDocument && (
                <Paper p="sm" withBorder>
                  <Text size="sm" fw={500} mb="xs">Selected File:</Text>
                  <Text size="xs" c="dimmed">
                    {form.values.denialDocument.name} ({(form.values.denialDocument.size / 1024 / 1024).toFixed(2)} MB)
                  </Text>
                </Paper>
              )}

              <Text size="sm" c="dimmed">
                <strong>Tip:</strong> Uploading the denial letter will allow our AI to analyze the denial 
                and identify the best opportunities for a successful dispute.
              </Text>
            </Stack>
          </Stepper.Step>
        </Stepper>

        <Group justify="space-between" mt="xl">
          <Group>
            {activeStep > 0 && (
              <Button variant="default" onClick={prevStep}>
                Back
              </Button>
            )}
          </Group>
          
          <Group>
            <Button
              variant="subtle"
              onClick={handleClose}
              disabled={loading}
              leftSection={<IconX size="1rem" />}
            >
              Cancel
            </Button>
            
            {activeStep < 2 ? (
              <Button 
                onClick={nextStep}
                disabled={activeStep === 0 && !canProceedToNext()}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                loading={loading}
                leftSection={<IconFileText size="1rem" />}
                disabled={codeValidation.cptValidation?.status === 'failed' || codeValidation.icdValidation?.status === 'failed'}
              >
                Create Dispute
              </Button>
            )}
          </Group>
        </Group>
      </form>
    </Modal>
  );
};

export default CreateDisputeModal;