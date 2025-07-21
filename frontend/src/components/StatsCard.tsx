import { Paper, Group, Text, ThemeIcon, Skeleton } from '@mantine/core';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}


const StatsCard = ({ title, value, icon: Icon, color, loading }: StatsCardProps) => {
  if (loading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between">
          <div>
            <Skeleton height={12} width={100} mb="xs" />
            <Skeleton height={24} width={60} />
          </div>
          <Skeleton height={40} width={40} radius="md" />
        </Group>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" tt="uppercase" fw={700} size="xs">
            {title}
          </Text>
          <Text fw={700} size="xl">
            {value}
          </Text>
        </div>
        <ThemeIcon color={color} variant="light" size="xl" radius="md">
          <Icon size={24} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
};

export default StatsCard;