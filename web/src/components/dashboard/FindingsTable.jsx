import {
  Box,
  Table,
  Text,
  HStack,
  VStack,
  IconButton,
  Link,
  Skeleton,
} from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import {
  FiChevronLeft,
  FiChevronRight,
  FiExternalLink,
  FiMessageSquare,
  FiChevronUp,
  FiChevronDown,
} from 'react-icons/fi';
import { SeverityBadge, LocalStatusBadge, TypeBadge } from './StatusBadge';

export function FindingsTable({
  findings,
  loading,
  total,
  currentPage,
  totalPages,
  onPageChange,
  onFindingClick,
  filters,
  onSort,
}) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const handleSort = (column) => {
    const newOrder =
      filters.sortBy === column && filters.sortOrder === 'desc' ? 'asc' : 'desc';
    onSort({ sortBy: column, sortOrder: newOrder });
  };

  const SortIcon = ({ column }) => {
    if (filters.sortBy !== column) return null;
    return filters.sortOrder === 'asc' ? (
      <FiChevronUp size={14} />
    ) : (
      <FiChevronDown size={14} />
    );
  };

  if (loading) {
    return (
      <Box
        bg={bgColor}
        borderWidth="1px"
        borderColor={borderColor}
        borderRadius="lg"
        overflow="hidden"
      >
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} height="60px" m={2} />
        ))}
      </Box>
    );
  }

  if (!findings || findings.length === 0) {
    return (
      <Box
        bg={bgColor}
        borderWidth="1px"
        borderColor={borderColor}
        borderRadius="lg"
        p={8}
        textAlign="center"
      >
        <Text color="gray.500">No findings match your filters.</Text>
      </Box>
    );
  }

  return (
    <Box
      bg={bgColor}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      overflow="hidden"
    >
      <Box overflowX="auto">
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader
                cursor="pointer"
                onClick={() => handleSort('severity')}
                _hover={{ bg: hoverBg }}
              >
                <HStack gap={1}>
                  <Text>Severity</Text>
                  <SortIcon column="severity" />
                </HStack>
              </Table.ColumnHeader>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader
                cursor="pointer"
                onClick={() => handleSort('local_status')}
                _hover={{ bg: hoverBg }}
              >
                <HStack gap={1}>
                  <Text>Status</Text>
                  <SortIcon column="local_status" />
                </HStack>
              </Table.ColumnHeader>
              <Table.ColumnHeader>Message</Table.ColumnHeader>
              <Table.ColumnHeader>Component</Table.ColumnHeader>
              <Table.ColumnHeader
                cursor="pointer"
                onClick={() => handleSort('first_seen_at')}
                _hover={{ bg: hoverBg }}
              >
                <HStack gap={1}>
                  <Text>First Seen</Text>
                  <SortIcon column="first_seen_at" />
                </HStack>
              </Table.ColumnHeader>
              <Table.ColumnHeader>Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {findings.map((finding) => (
              <Table.Row
                key={finding.id}
                cursor="pointer"
                _hover={{ bg: hoverBg }}
                onClick={() => onFindingClick?.(finding)}
              >
                <Table.Cell>
                  <SeverityBadge severity={finding.severity} />
                </Table.Cell>
                <Table.Cell>
                  <TypeBadge type={finding.type} />
                </Table.Cell>
                <Table.Cell>
                  <LocalStatusBadge status={finding.local_status} />
                </Table.Cell>
                <Table.Cell maxW="300px">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" noOfLines={2}>
                      {finding.message}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {finding.rule_name || finding.rule_key}
                    </Text>
                  </VStack>
                </Table.Cell>
                <Table.Cell maxW="200px">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" noOfLines={1}>
                      {finding.component}
                    </Text>
                    {finding.line && (
                      <Text fontSize="xs" color="gray.500">
                        Line {finding.line}
                      </Text>
                    )}
                  </VStack>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" color="gray.500">
                    {new Date(finding.first_seen_at).toLocaleDateString()}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <HStack gap={1}>
                    {finding.comment_count > 0 && (
                      <HStack gap={0.5} color="gray.500">
                        <FiMessageSquare size={14} />
                        <Text fontSize="xs">{finding.comment_count}</Text>
                      </HStack>
                    )}
                    {finding.sonar_link && (
                      <IconButton
                        aria-label="View in SonarQube"
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(finding.sonar_link, '_blank');
                        }}
                      >
                        <FiExternalLink />
                      </IconButton>
                    )}
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* Pagination */}
      <Box borderTopWidth="1px" borderColor={borderColor} p={3}>
        <HStack justify="space-between">
          <Text fontSize="sm" color="gray.500">
            Showing {findings.length} of {total} findings
          </Text>
          <HStack gap={2}>
            <IconButton
              aria-label="Previous page"
              variant="ghost"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <FiChevronLeft />
            </IconButton>
            <Text fontSize="sm">
              Page {currentPage + 1} of {totalPages || 1}
            </Text>
            <IconButton
              aria-label="Next page"
              variant="ghost"
              size="sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <FiChevronRight />
            </IconButton>
          </HStack>
        </HStack>
      </Box>
    </Box>
  );
}
