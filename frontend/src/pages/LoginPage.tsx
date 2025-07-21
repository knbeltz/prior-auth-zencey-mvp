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
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconMail, IconLock } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

interface LoginForm {
  email: string;
  password: string;
}

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { login, forgotPassword, error, clearError } = useAuth();
  const navigate = useNavigate();

  const form = useForm<LoginForm>({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => (value.length < 6 ? 'Password must be at least 6 characters' : null),
    },
  });

  const forgotPasswordForm = useForm({
    initialValues: {
      email: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
    },
  });

  const handleLogin = async (values: LoginForm) => {
    try {
      setLoading(true);
      clearError();
      await login(values.email, values.password);
      navigate('/dashboard');
    } catch (error) {
      // Error is handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (values: { email: string }) => {
    try {
      setLoading(true);
      await forgotPassword(values.email);
      setShowForgotPassword(false);
      forgotPasswordForm.reset();
    } catch (error) {
      // Error is handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <Container size={420} my={40}>
        <Title ta="center" style={(theme) => ({ fontFamily: theme.fontFamily, fontWeight: 900 })}>
          Reset Password
        </Title>
        <Text c="dimmed" size="sm" ta="center" mt={5}>
          Enter your email to receive reset instructions
        </Text>

        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <form onSubmit={forgotPasswordForm.onSubmit(handleForgotPassword)}>
            <Stack>
              {error && (
                <Alert icon={<IconAlertCircle size="1rem" />} title="Error" color="red">
                  {error}
                </Alert>
              )}

              <TextInput
                label="Email"
                placeholder="your@email.com"
                required
                leftSection={<IconMail size="1rem" />}
                {...forgotPasswordForm.getInputProps('email')}
              />

              <Group justify="space-between">
                <Button
                  variant="subtle"
                  onClick={() => setShowForgotPassword(false)}
                  disabled={loading}
                >
                  Back to Login
                </Button>
                <Button type="submit" loading={loading}>
                  Send Reset Email
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" style={(theme) => ({ fontFamily: theme.fontFamily, fontWeight: 900 })}>
        Prior Authorization Dispute System
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Sign in to your physician dashboard
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(handleLogin)}>
          <Stack>
            {error && (
              <Alert icon={<IconAlertCircle size="1rem" />} title="Login Failed" color="red">
                {error}
              </Alert>
            )}

            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              leftSection={<IconMail size="1rem" />}
              {...form.getInputProps('email')}
            />

            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              leftSection={<IconLock size="1rem" />}
              {...form.getInputProps('password')}
            />

            <Group justify="space-between">
              <Anchor
                size="sm"
                onClick={() => setShowForgotPassword(true)}
                style={{ cursor: 'pointer' }}
              >
                Forgot password?
              </Anchor>
            </Group>

            <Button type="submit" fullWidth loading={loading}>
              Sign In
            </Button>
          </Stack>
        </form>

        <Divider label="New to the platform?" labelPosition="center" my="lg" />

        <Group justify="center">
          <Text size="sm">
            Don't have an account?{' '}
            <Anchor component={Link} to="/signup" size="sm">
              Create account
            </Anchor>
          </Text>
        </Group>
      </Paper>

      <Box ta="center" mt="xl">
        <Text size="xs" c="dimmed">
          Secure healthcare prior authorization management
        </Text>
      </Box>
    </Container>
  );
};

export default LoginPage;