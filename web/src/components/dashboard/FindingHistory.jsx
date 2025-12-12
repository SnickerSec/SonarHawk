import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
} from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import {
  FiFlag,
  FiUser,
  FiMessageSquare,
  FiClock,
  FiRefreshCw,
  FiAlertCircle,
} from 'react-icons/fi';

const actionIcons = {
  status_change: FiFlag,
  assignment: FiUser,
  comment_added: FiMessageSquare,
  priority_change: FiAlertCircle,
  created: FiClock,
  synced: FiRefreshCw,
};

const actionLabels = {
  status_change: 'changed status',
  assignment: 'changed assignee',
  comment_added: 'added a comment',
  priority_change: 'changed priority',
  created: 'created',
  synced: 'synced',
};

export function FindingHistory({ history }) {
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const lineColor = useColorModeValue('gray.200', 'gray.600');

  if (!history || history.length === 0) {
    return (
      <Text color={mutedColor} fontSize="sm">
        No history available.
      </Text>
    );
  }

  return (
    <VStack gap={0} align="stretch" position="relative">
      {/* Timeline line */}
      <Box
        position="absolute"
        left="11px"
        top="24px"
        bottom="24px"
        width="2px"
        bg={lineColor}
        zIndex={0}
      />

      {history.map((entry, index) => {
        const IconComponent = actionIcons[entry.action] || FiClock;

        return (
          <HStack
            key={entry.id}
            gap={3}
            py={3}
            position="relative"
            zIndex={1}
          >
            {/* Icon */}
            <Box
              p={1.5}
              borderRadius="full"
              bg={useColorModeValue('white', 'gray.800')}
              borderWidth="2px"
              borderColor={borderColor}
            >
              <Icon as={IconComponent} boxSize={3} color={mutedColor} />
            </Box>

            {/* Content */}
            <Box flex="1">
              <HStack justify="space-between" flexWrap="wrap">
                <Text fontSize="sm">
                  <Text as="span" fontWeight="medium">
                    {entry.performed_by || 'System'}
                  </Text>{' '}
                  {actionLabels[entry.action] || entry.action}
                  {entry.old_value && entry.new_value && (
                    <>
                      {' '}
                      from{' '}
                      <Text as="span" fontWeight="medium">
                        {formatValue(entry.old_value)}
                      </Text>{' '}
                      to{' '}
                      <Text as="span" fontWeight="medium">
                        {formatValue(entry.new_value)}
                      </Text>
                    </>
                  )}
                  {!entry.old_value && entry.new_value && (
                    <>
                      {' '}
                      to{' '}
                      <Text as="span" fontWeight="medium">
                        {formatValue(entry.new_value)}
                      </Text>
                    </>
                  )}
                </Text>
                <Text fontSize="xs" color={mutedColor}>
                  {formatTime(entry.created_at)}
                </Text>
              </HStack>
            </Box>
          </HStack>
        );
      })}
    </VStack>
  );
}

function formatValue(value) {
  if (!value) return 'none';
  // Format snake_case to Title Case
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
