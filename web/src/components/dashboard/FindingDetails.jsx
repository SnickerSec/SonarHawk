import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Link,
  Tabs,
  Spinner,
  Textarea,
  Input,
} from '@chakra-ui/react';
import {
  DrawerRoot,
  DrawerBackdrop,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerTitle,
} from '../ui/drawer';
import { useColorModeValue } from '../ui/color-mode';
import {
  FiExternalLink,
  FiUser,
  FiCalendar,
  FiClock,
  FiFlag,
} from 'react-icons/fi';
import { useFinding } from '../../hooks/useFindings';
import { SeverityBadge, LocalStatusBadge, TypeBadge, PriorityBadge } from './StatusBadge';
import { FindingComments } from './FindingComments';
import { FindingHistory } from './FindingHistory';

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'wontfix', label: "Won't Fix" },
];

const priorityOptions = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Low' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
  { value: 4, label: 'Critical' },
];

export function FindingDetails({ findingId, isOpen, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('details');
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');

  const {
    finding,
    loading,
    error,
    updateStatus,
    updateAssignment,
    updatePriority,
    addComment,
    refresh,
  } = useFinding(findingId);

  const handleStatusChange = async (e) => {
    try {
      await updateStatus(e.target.value);
      onUpdate?.();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handlePriorityChange = async (e) => {
    try {
      await updatePriority(parseInt(e.target.value));
      onUpdate?.();
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleAssignmentChange = async (e) => {
    try {
      await updateAssignment(e.target.value || null);
      onUpdate?.();
    } catch (err) {
      console.error('Failed to update assignment:', err);
    }
  };

  const handleAddComment = async (content) => {
    try {
      await addComment('User', content);
      refresh();
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  return (
    <DrawerRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DrawerBackdrop />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Finding Details</DrawerTitle>
          <DrawerCloseTrigger />
        </DrawerHeader>
        <DrawerBody>
          {loading ? (
            <Box textAlign="center" py={8}>
              <Spinner size="lg" />
            </Box>
          ) : error ? (
            <Box textAlign="center" py={8}>
              <Text color="red.500">{error}</Text>
            </Box>
          ) : finding ? (
            <VStack gap={6} align="stretch">
              {/* Header Info */}
              <Box>
                <HStack gap={2} mb={2}>
                  <SeverityBadge severity={finding.severity} />
                  <TypeBadge type={finding.type} />
                  <LocalStatusBadge status={finding.local_status} />
                </HStack>
                <Text fontSize="lg" fontWeight="semibold">
                  {finding.message}
                </Text>
                <Text fontSize="sm" color={mutedColor} mt={1}>
                  {finding.rule_name || finding.rule_key}
                </Text>
              </Box>

              {/* Location */}
              <Box
                bg={useColorModeValue('gray.50', 'gray.900')}
                p={3}
                borderRadius="md"
              >
                <HStack justify="space-between">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" fontWeight="medium">
                      {finding.component}
                    </Text>
                    {finding.line && (
                      <Text fontSize="xs" color={mutedColor}>
                        Line {finding.line}
                      </Text>
                    )}
                  </VStack>
                  {finding.sonar_link && (
                    <Link href={finding.sonar_link} target="_blank">
                      <Button variant="outline" size="sm">
                        <FiExternalLink />
                        View in SonarQube
                      </Button>
                    </Link>
                  )}
                </HStack>
              </Box>

              {/* Management Controls */}
              <Box
                borderWidth="1px"
                borderColor={borderColor}
                borderRadius="md"
                p={4}
              >
                <Text fontWeight="medium" mb={3}>
                  Tracking
                </Text>
                <VStack gap={3} align="stretch">
                  {/* Status */}
                  <HStack>
                    <Box w="100px">
                      <Text fontSize="sm" color={mutedColor}>
                        <FiFlag style={{ display: 'inline', marginRight: 4 }} />
                        Status
                      </Text>
                    </Box>
                    <Box
                      as="select"
                      flex="1"
                      value={finding.local_status || 'new'}
                      onChange={handleStatusChange}
                      bg={bgColor}
                      borderWidth="1px"
                      borderColor={borderColor}
                      borderRadius="md"
                      px={3}
                      py={2}
                      fontSize="sm"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Box>
                  </HStack>

                  {/* Priority */}
                  <HStack>
                    <Box w="100px">
                      <Text fontSize="sm" color={mutedColor}>
                        <FiFlag style={{ display: 'inline', marginRight: 4 }} />
                        Priority
                      </Text>
                    </Box>
                    <Box
                      as="select"
                      flex="1"
                      value={finding.priority || 0}
                      onChange={handlePriorityChange}
                      bg={bgColor}
                      borderWidth="1px"
                      borderColor={borderColor}
                      borderRadius="md"
                      px={3}
                      py={2}
                      fontSize="sm"
                    >
                      {priorityOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Box>
                  </HStack>

                  {/* Assignee */}
                  <HStack>
                    <Box w="100px">
                      <Text fontSize="sm" color={mutedColor}>
                        <FiUser style={{ display: 'inline', marginRight: 4 }} />
                        Assignee
                      </Text>
                    </Box>
                    <Input
                      flex="1"
                      placeholder="Enter email or name"
                      value={finding.assigned_to || ''}
                      onChange={handleAssignmentChange}
                      size="sm"
                    />
                  </HStack>
                </VStack>
              </Box>

              {/* Dates */}
              <HStack gap={6} color={mutedColor} fontSize="sm">
                <HStack>
                  <FiClock />
                  <Text>First seen: {new Date(finding.first_seen_at).toLocaleString()}</Text>
                </HStack>
                <HStack>
                  <FiCalendar />
                  <Text>Last seen: {new Date(finding.last_seen_at).toLocaleString()}</Text>
                </HStack>
              </HStack>

              {/* Tabs for Comments/History */}
              <Tabs.Root
                value={activeTab}
                onValueChange={(e) => setActiveTab(e.value)}
              >
                <Tabs.List>
                  <Tabs.Trigger value="details">Description</Tabs.Trigger>
                  <Tabs.Trigger value="comments">
                    Comments ({finding.comments?.length || 0})
                  </Tabs.Trigger>
                  <Tabs.Trigger value="history">History</Tabs.Trigger>
                </Tabs.List>

                <Box mt={4}>
                  <Tabs.Content value="details">
                    {finding.description ? (
                      <Box
                        dangerouslySetInnerHTML={{ __html: finding.description }}
                        fontSize="sm"
                        sx={{
                          '& a': { color: 'blue.500' },
                          '& code': {
                            bg: useColorModeValue('gray.100', 'gray.700'),
                            px: 1,
                            borderRadius: 'sm',
                          },
                        }}
                      />
                    ) : (
                      <Text color={mutedColor}>No description available.</Text>
                    )}
                  </Tabs.Content>

                  <Tabs.Content value="comments">
                    <FindingComments
                      comments={finding.comments || []}
                      onAddComment={handleAddComment}
                    />
                  </Tabs.Content>

                  <Tabs.Content value="history">
                    <FindingHistory history={finding.history || []} />
                  </Tabs.Content>
                </Box>
              </Tabs.Root>
            </VStack>
          ) : null}
        </DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
}
