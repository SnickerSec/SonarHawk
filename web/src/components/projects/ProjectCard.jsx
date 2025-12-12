import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  IconButton,
} from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import {
  FiMoreVertical,
  FiRefreshCw,
  FiEdit,
  FiTrash2,
  FiExternalLink,
} from 'react-icons/fi';

export function ProjectCard({
  project,
  onSelect,
  onEdit,
  onDelete,
  onSync,
  selected,
}) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const selectedBorderColor = useColorModeValue('blue.500', 'blue.400');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box
      bg={bgColor}
      borderWidth="2px"
      borderColor={selected ? selectedBorderColor : borderColor}
      borderRadius="lg"
      p={4}
      cursor="pointer"
      transition="all 0.2s"
      _hover={{
        borderColor: selected ? selectedBorderColor : 'blue.300',
        shadow: 'md',
      }}
      onClick={() => onSelect?.(project)}
    >
      <VStack align="stretch" gap={3}>
        <HStack justify="space-between">
          <Text fontWeight="semibold" fontSize="md" noOfLines={1}>
            {project.name}
          </Text>
          <HStack gap={1}>
            <IconButton
              aria-label="Sync project"
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onSync?.(project);
              }}
            >
              <FiRefreshCw />
            </IconButton>
            <IconButton
              aria-label="Edit project"
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(project);
              }}
            >
              <FiEdit />
            </IconButton>
            <IconButton
              aria-label="Delete project"
              variant="ghost"
              size="xs"
              colorPalette="red"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(project);
              }}
            >
              <FiTrash2 />
            </IconButton>
          </HStack>
        </HStack>

        <Text fontSize="sm" color={mutedColor} noOfLines={1}>
          {project.sonar_component}
        </Text>

        <HStack gap={2} flexWrap="wrap">
          {project.branch && (
            <Badge colorPalette="blue" variant="subtle" size="sm">
              {project.branch}
            </Badge>
          )}
          {project.finding_count > 0 && (
            <Badge colorPalette="orange" variant="subtle" size="sm">
              {project.finding_count} findings
            </Badge>
          )}
          {project.new_finding_count > 0 && (
            <Badge colorPalette="red" variant="solid" size="sm">
              {project.new_finding_count} new
            </Badge>
          )}
          {project.sync_enabled && (
            <Badge colorPalette="green" variant="outline" size="sm">
              Auto-sync
            </Badge>
          )}
        </HStack>

        {project.last_sync_at && (
          <Text fontSize="xs" color={mutedColor}>
            Last sync: {new Date(project.last_sync_at).toLocaleString()}
          </Text>
        )}
      </VStack>
    </Box>
  );
}
