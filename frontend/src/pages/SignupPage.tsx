import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Stack,
  Alert,
  Anchor,
  Divider,
  Box,
  Progress,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconMail, IconLock, IconUser } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const getPasswordStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 6) strength += 25;
  if (password.length >= 8) strength += 25;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
  if (/\d/.test(password)) strength += 25;
  return strength;
};

const getPasswordColor = (strength: number) => {
  if (strength < 50) return 'red';
  if (strength < 75) return 'yellow';
  return 'green';
};

const SignupPage = () => {
  const [loading, setLoading] = useState(false);
  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();

  const form = useForm<SignupForm>({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validate: {
      firstName: (value) => (value.trim().length < 2 ? 'First name must be at least 2 characters' : null),
      lastName: (value) => (value.trim().length < 2 ? 'Last name must be at least 2 characters' : null),
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => {
        if (value.length < 6) return 'Password must be at least 6 characters';
        if (!/(?=.*[a-z])(?=.*[A-Z])/.test(value)) return 'Password must contain both uppercase and lowercase letters';
        if (!/(?=.*\d)/.test(value)) return 'Password must contain at least one number';
        return null;
      },
      confirmPassword: (value, values) =>
        value !== values.password ? 'Passwords do not match' : null,
    },
  });

  const passwordStrength = getPasswordStrength(form.values.password);
  const passwordColor = getPasswordColor(passwordStrength);

  const handleSignup = async (values: SignupForm) => {
    try {
      setLoading(true);
      clearError();
      await register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email,
        password: values.password,
      });
      navigate('/dashboard');
    } catch (error) {
      // Error is handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center" style={(theme) => ({ fontFamily: theme.fontFamily, fontWeight: 900 })}>
        Create Account
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Join the Prior Authorization Dispute System
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(handleSignup)}>
          <Stack>
            {error && (
              <Alert icon={<IconAlertCircle size="1rem" />} title="Registration Failed" color="red">
                {error}
              </Alert>
            )}

            <Group grow>
              <TextInput
                label="First Name"
                placeholder="John"
                required
                leftSection={<IconUser size="1rem" />}
                {...form.getInputProps('firstName')}
              />
              <TextInput
                label="Last Name"
                placeholder="Doe"
                required
                leftSection={<IconUser size="1rem" />}
                {...form.getInputProps('lastName')}
              />
            </Group>

            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              leftSection={<IconMail size="1rem" />}
              {...form.getInputProps('email')}
            />

            <PasswordInput
              label="Password"
              placeholder="Create a strong password"
              required
              leftSection={<IconLock size="1rem" />}
              {...form.getInputProps('password')}
            />

            {form.values.password.length > 0 && (
              <Group gap="xs">
                <Text size="xs">Password strength:</Text>
                <Progress
                  value={passwordStrength}
                  color={passwordColor}
                  size="sm"
                  style={{ flex: 1 }}
                />
              </Group>
            )}

            <PasswordInput
              label="Confirm Password"
              placeholder="Confirm your password"
              required
              leftSection={<IconLock size="1rem" />}
              {...form.getInputProps('confirmPassword')}
            />

            <Button type="submit" fullWidth loading={loading} mt="md">
              Create Account
            </Button>
          </Stack>
        </form>

        <Divider label="Already have an account?" labelPosition="center" my="lg" />

        <Group justify="center">
          <Text size="sm">
            <Anchor component={Link} to="/login" size="sm">
              Sign in instead
            </Anchor>
          </Text>
        </Group>
      </Paper>

      <Box ta="center" mt="xl">
        <Text size="xs" c="dimmed">
          By creating an account, you agree to our terms of service and privacy policy
        </Text>
      </Box>
    </Container>
  );
};

export default SignupPage;