import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  SimpleGrid,
  Spinner,
} from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import { FiPlus } from 'react-icons/fi';
import { ProjectCard } from './ProjectCard';

export function ProjectList({
  projects,
  loading,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onSync,
  onAdd,
}) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  if (loading) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner size="lg" />
        <Text mt={4}>Loading projects...</Text>
      </Box>
    );
  }

  return (
    <VStack gap={4} align="stretch">
      <HStack justify="space-between">
        <Text fontSize="lg" fontWeight="semibold">
          Projects ({projects?.length || 0})
        </Text>
        <Button colorPalette="blue" size="sm" onClick={onAdd}>
          <FiPlus />
          Add Project
        </Button>
      </HStack>

      {!projects || projects.length === 0 ? (
        <Box
          bg={bgColor}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="lg"
          p={8}
          textAlign="center"
        >
          <Text color="gray.500" mb={4}>
            No projects configured yet.
          </Text>
          <Button colorPalette="blue" onClick={onAdd}>
            <FiPlus />
            Add Your First Project
          </Button>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              selected={project.id === selectedId}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onSync={onSync}
            />
          ))}
        </SimpleGrid>
      )}
    </VStack>
  );
}
