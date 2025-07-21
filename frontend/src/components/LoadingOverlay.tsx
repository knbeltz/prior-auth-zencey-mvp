import { Center, Loader, Text, Stack } from '@mantine/core';

interface LoadingOverlayProps {
  message?: string;
}

const LoadingOverlay = ({ message = 'Loading...' }: LoadingOverlayProps) => {
  return (
    <Center style={{ minHeight: '100vh' }}>
      <Stack align="center" gap="md">
        <Loader size="lg" />
        <Text c="dimmed">{message}</Text>
      </Stack>
    </Center>
  );
};

export default LoadingOverlay;