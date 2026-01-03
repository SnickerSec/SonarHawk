import {
  Box,
  Button,
  Input,
  Switch,
  VStack,
  Accordion,
  Heading,
  Textarea,
  HStack,
  Text,
  Progress,
  Alert,
  Spinner,
  Badge,
  Field,
  Separator,
} from '@chakra-ui/react'
import { toaster } from './ui/toaster'
import { useForm } from 'react-hook-form'
import { useState } from 'react'

// Chakra v3 compatibility aliases
const FormControl = Field.Root;
const FormLabel = Field.Label;

export function ReportForm() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      darkTheme: true
    }
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [generatingStep, setGeneratingStep] = useState('')

  // Test connection function
  const testConnection = async () => {
    const formData = watch()

    // Validate required fields
    if (!formData.sonarurl) {
      toaster.create({
        title: 'Missing URL',
        description: 'Please enter a SonarQube URL',
        type: 'warning',
        duration: 3000
      })
      return
    }

    if (!formData.sonarcomponent) {
      toaster.create({
        title: 'Missing Project Key',
        description: 'Please enter a project key/component',
        type: 'warning',
        duration: 3000
      })
      return
    }

    setIsTesting(true)
    setConnectionStatus(null)

    try {
      const apiUrl = import.meta.env.PROD
        ? '/api/test-connection'
        : 'http://localhost:3000/api/test-connection'

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sonarurl: formData.sonarurl,
          sonarcomponent: formData.sonarcomponent,
          sonartoken: formData.sonartoken,
          sonarusername: formData.sonarusername,
          sonarpassword: formData.sonarpassword
        })
      })

      const result = await response.json()

      if (result.success) {
        setConnectionStatus({ success: true, message: result.message, server: result.server })
        toaster.create({
          title: 'Connection Successful',
          description: `Connected to SonarQube ${result.server.version}`,
          type: 'success',
          duration: 5000
        })
      } else {
        setConnectionStatus({ success: false, message: result.error })
        toaster.create({
          title: 'Connection Failed',
          description: result.error,
          type: 'error',
          duration: 5000
        })
      }
    } catch (error) {
      setConnectionStatus({ success: false, message: error.message })
      toaster.create({
        title: 'Connection Error',
        description: 'Failed to test connection. Please check your settings.',
        type: 'error',
        duration: 5000
      })
    } finally {
      setIsTesting(false)
    }
  }

  const onSubmit = async (data) => {
    setIsGenerating(true)
    setGeneratingStep('Preparing request...')

    try {
      // Clean up data - convert empty strings to undefined and handle switches
      const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value === '' || value === null) return acc
        if (typeof value === 'boolean') {
          acc[key] = value
        } else {
          acc[key] = value
        }
        return acc
      }, {})

      console.log('Sending request to API...', cleanData)
      setGeneratingStep('Connecting to SonarQube...')

      const apiUrl = import.meta.env.PROD
        ? '/api/generate'
        : 'http://localhost:3000/api/generate'

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(cleanData)
      })

      setGeneratingStep('Collecting data...')

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate report' }))
        throw new Error(error.error || 'Failed to generate report')
      }

      setGeneratingStep('Generating report...')
      const blob = await response.blob()

      setGeneratingStep('Downloading...')
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'codeguard-report.html'
      a.click()

      toaster.create({
        title: 'Report Generated',
        description: 'Your report has been downloaded successfully',
        type: 'success',
        duration: 3000
      })
    } catch (error) {
      console.error('Generation error:', error)
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
        duration: 5000
      })
    } finally {
      setIsGenerating(false)
      setGeneratingStep('')
    }
  }

  return (
    <Box as="form" onSubmit={handleSubmit(onSubmit)} width="100%" maxW="800px">
      <VStack spacing={6} align="stretch">

        {/* Required Fields */}
        <Box>
          <Heading size="md" mb={4}>Required Configuration</Heading>
          <VStack spacing={4}>
            <FormControl isRequired isInvalid={errors.sonarurl}>
              <FormLabel>SonarQube URL</FormLabel>
              <Input
                {...register('sonarurl', {
                  required: 'SonarQube URL is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Must be a valid URL (http:// or https://)'
                  }
                })}
                placeholder="https://sonar.company.com"
                type="url"
              />
              {errors.sonarurl && (
                <FormErrorMessage>{errors.sonarurl.message}</FormErrorMessage>
              )}
            </FormControl>

            <FormControl isRequired isInvalid={errors.sonarcomponent}>
              <FormLabel>Project Key / Component</FormLabel>
              <Input
                {...register('sonarcomponent', {
                  required: 'Project key is required',
                  minLength: {
                    value: 2,
                    message: 'Project key must be at least 2 characters'
                  }
                })}
                placeholder="project:key"
              />
              {errors.sonarcomponent ? (
                <FormErrorMessage>{errors.sonarcomponent.message}</FormErrorMessage>
              ) : (
                <Text fontSize="sm" color="gray.500" mt={1}>
                  The SonarQube component/project key to analyze
                </Text>
              )}
            </FormControl>

            {/* Test Connection Button */}
            <Button
              onClick={testConnection}
              isLoading={isTesting}
              loadingText="Testing..."
              variant="outline"
              size="sm"
              width="full"
            >
              Test Connection
            </Button>

            {/* Connection Status */}
            {connectionStatus && (
              <Alert status={connectionStatus.success ? 'success' : 'error'} borderRadius="md">
                <AlertIcon />
                <Box flex="1">
                  <AlertDescription>
                    {connectionStatus.message}
                    {connectionStatus.server && (
                      <Text fontSize="xs" mt={1}>
                        SonarQube {connectionStatus.server.version} - {connectionStatus.server.status}
                      </Text>
                    )}
                  </AlertDescription>
                </Box>
              </Alert>
            )}
          </VStack>
        </Box>

        <Separator />

        {/* Accordion for organized options */}
        <Accordion.Root multiple>

          {/* Authentication */}
          <Accordion.Item value="auth">
            <Accordion.ItemTrigger>
              <Box flex="1" textAlign="left">
                <Heading size="sm">Authentication</Heading>
              </Box>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent pb={4}>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Auth Token (Recommended)</FormLabel>
                  <Input
                    type="password"
                    {...register('sonartoken')}
                    placeholder="squ_..."
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    SonarQube authentication token
                  </Text>
                </FormControl>

                <Text fontSize="sm" fontWeight="bold" color="gray.600" alignSelf="flex-start">
                  OR use Username/Password:
                </Text>

                <FormControl>
                  <FormLabel>Username</FormLabel>
                  <Input {...register('sonarusername')} />
                </FormControl>

                <FormControl>
                  <FormLabel>Password</FormLabel>
                  <Input type="password" {...register('sonarpassword')} />
                </FormControl>

                <FormControl>
                  <FormLabel>Organization (SonarCloud only)</FormLabel>
                  <Input
                    {...register('sonarorganization')}
                    placeholder="my-org"
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Required only for SonarCloud.io
                  </Text>
                </FormControl>
              </VStack>
            </Accordion.ItemContent>
          </Accordion.Item>

          {/* Project Metadata */}
          <Accordion.Item value="metadata">
            <Accordion.ItemTrigger>
              <Box flex="1" textAlign="left">
                <Heading size="sm">Project Metadata</Heading>
              </Box>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent pb={4}>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Project Name</FormLabel>
                  <Input
                    {...register('project')}
                    placeholder="My Project"
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Display name in the report header
                  </Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Application Name</FormLabel>
                  <Input
                    {...register('application')}
                    placeholder="My Application"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Release Version</FormLabel>
                  <Input
                    {...register('release')}
                    placeholder="v1.0.0"
                  />
                </FormControl>
              </VStack>
            </Accordion.ItemContent>
          </Accordion.Item>

          {/* Scope & Filtering */}
          <Accordion.Item value="scope">
            <Accordion.ItemTrigger>
              <Box flex="1" textAlign="left">
                <Heading size="sm">Scope & Filtering</Heading>
              </Box>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent pb={4}>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Branch</FormLabel>
                  <Input
                    {...register('branch')}
                    placeholder="main"
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Specific branch to analyze
                  </Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Pull Request ID</FormLabel>
                  <Input
                    {...register('pullrequest')}
                    placeholder="123"
                    type="number"
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Analyze specific pull request
                  </Text>
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    New Code Period Only
                  </FormLabel>
                  <Switch {...register('inNewCodePeriod')} />
                </FormControl>
                <Text fontSize="sm" color="gray.500" mt={-2}>
                  Report only on new code (delta analysis)
                </Text>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Include All Bugs
                  </FormLabel>
                  <Switch {...register('allbugs')} />
                </FormControl>
                <Text fontSize="sm" color="gray.500" mt={-2}>
                  Include all bugs, not just vulnerabilities
                </Text>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Include Security Hotspots
                  </FormLabel>
                  <Switch {...register('securityHotspot')} defaultChecked />
                </FormControl>
                <Text fontSize="sm" color="gray.500" mt={-2}>
                  Disable for SonarQube versions &lt; 7.3
                </Text>
              </VStack>
            </Accordion.ItemContent>
          </Accordion.Item>

          {/* Report Content */}
          <Accordion.Item value="content">
            <Accordion.ItemTrigger>
              <Box flex="1" textAlign="left">
                <Heading size="sm">Report Content</Heading>
              </Box>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent pb={4}>
              <VStack spacing={4}>
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Include Quality Gate Status
                  </FormLabel>
                  <Switch {...register('qualityGateStatus')} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Include Code Coverage
                  </FormLabel>
                  <Switch {...register('coverage')} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Link Issues to SonarQube
                  </FormLabel>
                  <Switch {...register('linkIssues')} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Include Security Rules Section
                  </FormLabel>
                  <Switch {...register('rulesInReport')} defaultChecked />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Only Show Detected Rules
                  </FormLabel>
                  <Switch {...register('onlyDetectedRules')} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Fix Missing Rules
                  </FormLabel>
                  <Switch {...register('fixMissingRule')} />
                </FormControl>
                <Text fontSize="sm" color="gray.500" mt={-2}>
                  Extract rules without type filtering
                </Text>
              </VStack>
            </Accordion.ItemContent>
          </Accordion.Item>

          {/* Appearance */}
          <Accordion.Item value="appearance">
            <Accordion.ItemTrigger>
              <Box flex="1" textAlign="left">
                <Heading size="sm">Appearance & Customization</Heading>
              </Box>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent pb={4}>
              <VStack spacing={4}>
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Dark Theme
                  </FormLabel>
                  <Switch {...register('darkTheme')} defaultChecked />
                </FormControl>

                <FormControl>
                  <FormLabel>Custom Vulnerability Label (Singular)</FormLabel>
                  <Input
                    {...register('vulnerabilityPhrase')}
                    placeholder="Vulnerability"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Custom Vulnerability Label (Plural)</FormLabel>
                  <Input
                    {...register('vulnerabilityPluralPhrase')}
                    placeholder="Vulnerabilities"
                  />
                </FormControl>
              </VStack>
            </Accordion.ItemContent>
          </Accordion.Item>

          {/* Advanced */}
          <Accordion.Item value="advanced">
            <Accordion.ItemTrigger>
              <Box flex="1" textAlign="left">
                <Heading size="sm">Advanced Options</Heading>
              </Box>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent pb={4}>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>HTTP Proxy</FormLabel>
                  <Input
                    {...register('httpProxy')}
                    placeholder="http://proxy.company.com:8080"
                    type="url"
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">
                    Debug Mode
                  </FormLabel>
                  <Switch {...register('debug')} />
                </FormControl>
                <Text fontSize="sm" color="gray.500" mt={-2}>
                  Enable verbose logging (check browser console)
                </Text>
              </VStack>
            </Accordion.ItemContent>
          </Accordion.Item>

        </Accordion.Root>

        {/* Loading Progress */}
        {isGenerating && (
          <Box>
            <Progress size="xs" isIndeterminate colorScheme="blue" mb={2} />
            <HStack justify="center" spacing={2}>
              <Spinner size="sm" />
              <Text fontSize="sm" color="gray.600">
                {generatingStep}
              </Text>
            </HStack>
          </Box>
        )}

        <Button
          type="submit"
          colorScheme="blue"
          size="lg"
          width="100%"
          isLoading={isGenerating}
          loadingText={generatingStep || 'Generating...'}
          isDisabled={isGenerating || isTesting}
        >
          Generate Report
        </Button>
      </VStack>
    </Box>
  )
}
