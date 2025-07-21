import { useState } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  Button,
  Stack,
  Group,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconFolder, IconX } from '@tabler/icons-react';
import { usePatientGroup } from '../context/PatientGroupContext';

interface CreatePatientGroupModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormData {
  name: string;
  description: string;
}

const CreatePatientGroupModal = ({ opened, onClose, onSuccess }: CreatePatientGroupModalProps) => {
  const [loading, setLoading] = useState(false);
  const { createPatientGroup } = usePatientGroup();

  const form = useForm<FormData>({
    initialValues: {
      name: '',
      description: '',
    },
    validate: {
      name: (value) => (value.trim().length < 2 ? 'Name must be at least 2 characters' : null),
    },
  });

  const handleSubmit = async (values: FormData) => {
    try {
      setLoading(true);
      await createPatientGroup({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
      });
      form.reset();
      onSuccess?.();
    } catch (error) {
      // Error is handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Create Patient Group"
      size="md"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <Text size="sm" c="dimmed">
            Create a new patient group to organize and manage your patients' prior authorization disputes.
          </Text>

          <TextInput
            label="Group Name"
            placeholder="Enter group name"
            required
            leftSection={<IconFolder size="1rem" />}
            {...form.getInputProps('name')}
          />

          <Textarea
            label="Description"
            placeholder="Optional description for this patient group"
            rows={3}
            {...form.getInputProps('description')}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={handleClose}
              disabled={loading}
              leftSection={<IconX size="1rem" />}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              leftSection={<IconFolder size="1rem" />}
            >
              Create Group
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default CreatePatientGroupModal;