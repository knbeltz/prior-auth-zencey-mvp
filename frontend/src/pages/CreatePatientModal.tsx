import { useState } from 'react';
import {
  Modal,
  TextInput,
  Select,
  Button,
  Stack,
  Group,
  Text,
  Grid,
  Stepper,
  Paper,
  FileInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { DateInput } from '@mantine/dates';
import { 
  IconUser, 
  IconX, 
  IconShieldCheck,
  IconFileText,
  IconUpload,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import api from '../utils/api';

interface CreatePatientModalProps {
  opened: boolean;
  onClose: () => void;
  groupId: string;
  onSuccess?: () => void;
}

interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string;
  insuranceProvider: string;
  policyNumber: string;
  groupNumber: string;
  subscriberId: string;
  planName: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

import { useMediaQuery } from '@mantine/hooks';

const isMobile = useMediaQuery('(max-width: 768px)');

const CreatePatientModal = ({ opened, onClose, groupId, onSuccess }: CreatePatientModalProps) => {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);

  const form = useForm<PatientFormData>({
    initialValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: null,
      gender: '',
      insuranceProvider: '',
      policyNumber: '',
      groupNumber: '',
      subscriberId: '',
      planName: '',
      phone: '',
      email: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
    },
    validate: {
      firstName: (value) => (value.trim().length < 2 ? 'First name must be at least 2 characters' : null),
      lastName: (value) => (value.trim().length < 2 ? 'Last name must be at least 2 characters' : null),
      dateOfBirth: (value) => (!value ? 'Date of birth is required' : null),
      insuranceProvider: (value) => (value.trim().length < 2 ? 'Insurance provider is required' : null),
      policyNumber: (value) => (value.trim().length < 2 ? 'Policy number is required' : null),
    },
  });

  const handleSubmit = async (values: PatientFormData) => {
    try {
      setLoading(true);
      
      const patientData = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        patientGroup: groupId,
        insuranceInfo: {
          provider: values.insuranceProvider.trim(),
          policyNumber: values.policyNumber.trim(),
          groupNumber: values.groupNumber.trim(),
          subscriberId: values.subscriberId.trim(),
          planName: values.planName.trim(),
        },
        contactInfo: {
          phone: values.phone.trim(),
          email: values.email.trim(),
          address: {
            street: values.street.trim(),
            city: values.city.trim(),
            state: values.state.trim(),
            zipCode: values.zipCode.trim(),
          },
        },
      };

      const response = await api.post('/patients', patientData);
      
      if (response.data.success) {
        // Upload files if any
        if (files.length > 0) {
          const patientId = response.data.patient._id;
          await uploadFiles(patientId);
        }

        notifications.show({
          title: 'Success',
          message: 'Patient created successfully',
          color: 'green',
        });
        
        form.reset();
        setActiveStep(0);
        setFiles([]);
        onSuccess?.();
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to create patient',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (patientId: string) => {
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('documentType', 'ehr');
        formData.append('description', 'Initial patient documents');

        await api.post(`/patients/${patientId}/documents`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }
    } catch (error) {
      console.error('Failed to upload some files:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    setActiveStep(0);
    setFiles([]);
    onClose();
  };

  const nextStep = () => setActiveStep((current) => Math.min(current + 1, 2));
  const prevStep = () => setActiveStep((current) => Math.max(current - 1, 0));

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Add New Patient"
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stepper active={activeStep} onStepClick={setActiveStep}  orientation={isMobile ? 'vertical' : 'horizontal'}>
          <Stepper.Step 
            label="Personal Info" 
            description="Basic patient information"
            icon={<IconUser size="1rem" />}
          >
            <Stack mt="md">
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="First Name"
                    placeholder="John"
                    required
                    {...form.getInputProps('firstName')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Last Name"
                    placeholder="Doe"
                    required
                    {...form.getInputProps('lastName')}
                  />
                </Grid.Col>
              </Grid>
              
              <Grid>
                <Grid.Col span={6}>
                  <DateInput
                    label="Date of Birth"
                    placeholder="Select date"
                    required
                    maxDate={new Date()}
                    {...form.getInputProps('dateOfBirth')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Gender"
                    placeholder="Select gender"
                    data={[
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' },
                    ]}
                    {...form.getInputProps('gender')}
                  />
                </Grid.Col>
              </Grid>

              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Phone"
                    placeholder="(555) 123-4567"
                    {...form.getInputProps('phone')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Email"
                    placeholder="patient@example.com"
                    type="email"
                    {...form.getInputProps('email')}
                  />
                </Grid.Col>
              </Grid>

              <TextInput
                label="Street Address"
                placeholder="123 Main St"
                {...form.getInputProps('street')}
              />
              
              <Grid>
                <Grid.Col span={4}>
                  <TextInput
                    label="City"
                    placeholder="New York"
                    {...form.getInputProps('city')}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="State"
                    placeholder="NY"
                    {...form.getInputProps('state')}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="ZIP Code"
                    placeholder="10001"
                    {...form.getInputProps('zipCode')}
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          </Stepper.Step>

          <Stepper.Step 
            label="Insurance" 
            description="Insurance information"
            icon={<IconShieldCheck size="1rem" />}
          >
            <Stack mt="md">
              <TextInput
                label="Insurance Provider"
                placeholder="Blue Cross Blue Shield"
                required
                {...form.getInputProps('insuranceProvider')}
              />
              
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Policy Number"
                    placeholder="ABC123456789"
                    required
                    {...form.getInputProps('policyNumber')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Group Number"
                    placeholder="GRP001"
                    {...form.getInputProps('groupNumber')}
                  />
                </Grid.Col>
              </Grid>

              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Subscriber ID"
                    placeholder="SUB123"
                    {...form.getInputProps('subscriberId')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Plan Name"
                    placeholder="PPO Gold"
                    {...form.getInputProps('planName')}
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          </Stepper.Step>

          <Stepper.Step 
            label="Documents" 
            description="Upload patient documents"
            icon={<IconFileText size="1rem" />}
          >
            <Stack mt="md">
              <Text size="sm" c="dimmed">
                Upload Electronic Health Records, insurance cards, or other relevant documents.
              </Text>
              
              <FileInput
                label="Patient Documents"
                placeholder="Click to select files"
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                leftSection={<IconUpload size="1rem" />}
                value={files}
                onChange={setFiles}
              />
              
              {files.length > 0 && (
                <Paper p="sm" withBorder>
                  <Text size="sm" fw={500} mb="xs">Selected Files:</Text>
                  {files.map((file, index) => (
                    <Text key={index} size="xs" c="dimmed">
                      • {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </Text>
                  ))}
                </Paper>
              )}
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
              <Button onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                loading={loading}
                leftSection={<IconUser size="1rem" />}
              >
                Create Patient
              </Button>
            )}
          </Group>
        </Group>
      </form>
    </Modal>
  );
};

export default CreatePatientModal;