import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Textarea,
  Switch,
  Field,
} from '@chakra-ui/react';

import {
  DialogRoot,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  DialogTitle,
} from '../ui/dialog';
import { useColorModeValue } from '../ui/color-mode';
import { FiSave, FiX } from 'react-icons/fi';

// Use Field.Root/Label/HelperText for Chakra v3 compatibility
const FormControl = Field.Root;
const FormLabel = Field.Label;
const FormHelperText = Field.HelperText;

const initialFormState = {
  name: '',
  description: '',
  sonarUrl: '',
  sonarComponent: '',
  sonarToken: '',
  sonarOrganization: '',
  branch: 'main',
  syncEnabled: true,
  syncIntervalMinutes: 60,
};

export function ProjectForm({ isOpen, onClose, onSubmit, project, loading }) {
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Populate form when editing
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        sonarUrl: project.sonar_url || '',
        sonarComponent: project.sonar_component || '',
        sonarToken: project.sonar_token || '',
        sonarOrganization: project.sonar_organization || '',
        branch: project.branch || 'main',
        syncEnabled: project.sync_enabled ?? true,
        syncIntervalMinutes: project.sync_interval_minutes || 60,
      });
    } else {
      setFormData(initialFormState);
    }
    setErrors({});
  }, [project, isOpen]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    if (!formData.sonarUrl.trim()) {
      newErrors.sonarUrl = 'SonarQube URL is required';
    } else {
      try {
        new URL(formData.sonarUrl);
      } catch {
        newErrors.sonarUrl = 'Please enter a valid URL';
      }
    }
    if (!formData.sonarComponent.trim()) {
      newErrors.sonarComponent = 'Project key is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save project:', error);
      setErrors({ submit: error.message });
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'Add Project'}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody>
          <VStack gap={4} align="stretch">
            {/* Project Name */}
            <FormControl isInvalid={!!errors.name}>
              <FormLabel>Project Name *</FormLabel>
              <Input
                placeholder="My SonarQube Project"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
              {errors.name && (
                <Text color="red.500" fontSize="sm" mt={1}>
                  {errors.name}
                </Text>
              )}
            </FormControl>

            {/* Description */}
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
              />
            </FormControl>

            {/* SonarQube URL */}
            <FormControl isInvalid={!!errors.sonarUrl}>
              <FormLabel>SonarQube URL *</FormLabel>
              <Input
                placeholder="https://sonarcloud.io or https://your-server.com"
                value={formData.sonarUrl}
                onChange={(e) => handleChange('sonarUrl', e.target.value)}
              />
              {errors.sonarUrl && (
                <Text color="red.500" fontSize="sm" mt={1}>
                  {errors.sonarUrl}
                </Text>
              )}
            </FormControl>

            {/* Project Key */}
            <FormControl isInvalid={!!errors.sonarComponent}>
              <FormLabel>Project Key *</FormLabel>
              <Input
                placeholder="org:project-key"
                value={formData.sonarComponent}
                onChange={(e) => handleChange('sonarComponent', e.target.value)}
              />
              <FormHelperText>
                The project key as shown in SonarQube
              </FormHelperText>
              {errors.sonarComponent && (
                <Text color="red.500" fontSize="sm" mt={1}>
                  {errors.sonarComponent}
                </Text>
              )}
            </FormControl>

            {/* Token */}
            <FormControl>
              <FormLabel>API Token</FormLabel>
              <Input
                type="password"
                placeholder="squ_xxxxx..."
                value={formData.sonarToken}
                onChange={(e) => handleChange('sonarToken', e.target.value)}
              />
              <FormHelperText>
                Required for private projects
              </FormHelperText>
            </FormControl>

            {/* Organization */}
            <FormControl>
              <FormLabel>Organization</FormLabel>
              <Input
                placeholder="your-org (for SonarCloud)"
                value={formData.sonarOrganization}
                onChange={(e) => handleChange('sonarOrganization', e.target.value)}
              />
            </FormControl>

            {/* Branch */}
            <FormControl>
              <FormLabel>Branch</FormLabel>
              <Input
                placeholder="main"
                value={formData.branch}
                onChange={(e) => handleChange('branch', e.target.value)}
              />
            </FormControl>

            {/* Auto-sync */}
            <HStack justify="space-between">
              <Box>
                <Text fontWeight="medium">Auto-sync</Text>
                <Text fontSize="sm" color="gray.500">
                  Automatically sync findings periodically
                </Text>
              </Box>
              <Switch.Root
                checked={formData.syncEnabled}
                onCheckedChange={(e) => handleChange('syncEnabled', e.checked)}
              >
                <Switch.Control />
              </Switch.Root>
            </HStack>

            {formData.syncEnabled && (
              <FormControl>
                <FormLabel>Sync Interval (minutes)</FormLabel>
                <Input
                  type="number"
                  value={formData.syncIntervalMinutes}
                  onChange={(e) =>
                    handleChange('syncIntervalMinutes', parseInt(e.target.value) || 60)
                  }
                  min={15}
                  max={1440}
                />
              </FormControl>
            )}

            {errors.submit && (
              <Text color="red.500" fontSize="sm">
                {errors.submit}
              </Text>
            )}
          </VStack>
        </DialogBody>
        <DialogFooter>
          <HStack gap={3}>
            <Button variant="ghost" onClick={onClose}>
              <FiX />
              Cancel
            </Button>
            <Button
              colorPalette="blue"
              onClick={handleSubmit}
              loading={loading}
            >
              <FiSave />
              {project ? 'Update' : 'Create'} Project
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
