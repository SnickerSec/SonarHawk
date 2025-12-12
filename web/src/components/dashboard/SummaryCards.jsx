import {
  SimpleGrid,
  Box,
  Text,
  HStack,
  VStack,
  Icon,
  Skeleton,
} from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import {
  FiAlertTriangle,
  FiAlertCircle,
  FiShield,
  FiCheckCircle,
  FiClock,
  FiActivity,
} from 'react-icons/fi';

function StatCard({ label, value, icon, color, subValue }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const iconBg = useColorModeValue(`${color}.100`, `${color}.900`);
  const iconColor = useColorModeValue(`${color}.600`, `${color}.200`);

  return (
    <Box
      bg={bgColor}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      p={4}
      shadow="sm"
    >
      <HStack justify="space-between">
        <VStack align="start" gap={0}>
          <Text fontSize="sm" color="gray.500">
            {label}
          </Text>
          <Text fontSize="2xl" fontWeight="bold">
            {value}
          </Text>
          {subValue && (
            <Text fontSize="xs" color="gray.400">
              {subValue}
            </Text>
          )}
        </VStack>
        <Box
          p={3}
          borderRadius="full"
          bg={iconBg}
          color={iconColor}
        >
          <Icon as={icon} boxSize={5} />
        </Box>
      </HStack>
    </Box>
  );
}

export function SummaryCards({ summary, loading }) {
  if (loading) {
    return (
      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} gap={4}>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} height="100px" borderRadius="lg" />
        ))}
      </SimpleGrid>
    );
  }

  if (!summary) {
    return null;
  }

  const criticalCount = parseInt(summary.blocker_count || 0) + parseInt(summary.critical_count || 0);
  const majorCount = parseInt(summary.major_count || 0);
  const totalCount = parseInt(summary.total || 0);
  const newCount = parseInt(summary.new_count || 0);
  const inProgressCount = parseInt(summary.in_progress_count || 0);
  const resolvedCount = parseInt(summary.resolved_count || 0);

  return (
    <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} gap={4}>
      <StatCard
        label="Total Findings"
        value={totalCount}
        icon={FiShield}
        color="blue"
      />
      <StatCard
        label="Critical"
        value={criticalCount}
        icon={FiAlertTriangle}
        color="red"
        subValue={`${summary.blocker_count || 0} Blocker, ${summary.critical_count || 0} Critical`}
      />
      <StatCard
        label="Major"
        value={majorCount}
        icon={FiAlertCircle}
        color="orange"
      />
      <StatCard
        label="New"
        value={newCount}
        icon={FiClock}
        color="purple"
      />
      <StatCard
        label="In Progress"
        value={inProgressCount}
        icon={FiActivity}
        color="cyan"
      />
      <StatCard
        label="Resolved"
        value={resolvedCount}
        icon={FiCheckCircle}
        color="green"
      />
    </SimpleGrid>
  );
}
