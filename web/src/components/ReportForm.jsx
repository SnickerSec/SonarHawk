import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  VStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Heading,
  Textarea,
  Select,
  HStack,
  Text,
  Divider,
  Progress,
  Alert,
  AlertIcon,
  AlertDescription,
  FormErrorMessage,
  Spinner,
  Badge,
  useToast,
  Tooltip,
  Kbd,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Link
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import { useState, useEffect } from 'react'
import { addToReportHistory } from './ReportHistory'

export function ReportForm() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      darkTheme: true
    }
  })
  const toast = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [generatingStep, setGeneratingStep] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const [reportBlob, setReportBlob] = useState(null)
  const [reportData, setReportData] = useState(null)
  const { isOpen, onOpen, onClose } = useDisclosure()

  // Watch SonarQube URL for dynamic token link
  const sonarUrl = watch('sonarurl')

  // Generate token URL based on user's SonarQube instance
  const getTokenUrl = () => {
    if (!sonarUrl) return null
    try {
      const baseUrl = sonarUrl.replace(/\/+$/, '') // Remove trailing slashes
      // SonarCloud uses different URL structure
      if (baseUrl.includes('sonarcloud.io')) {
        return 'https://sonarcloud.io/account/security'
      }
      return `${baseUrl}/account/security`
    } catch {
      return null
    }
  }

  const tokenUrl = getTokenUrl()

  // Keyboard shortcuts: Ctrl+Enter (or Cmd+Enter on Mac) to submit
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        if (!isGenerating && !isTesting) {
          handleSubmit(onSubmit)()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isGenerating, isTesting, handleSubmit])

  // Test connection function
  const testConnection = async () => {
    const formData = watch()

    // Validate required fields
    if (!formData.sonarurl) {
      toast({
        title: 'Missing URL',
        description: 'Please enter a SonarQube URL',
        status: 'warning',
        duration: 3000
      })
      return
    }

    if (!formData.sonarcomponent) {
      toast({
        title: 'Missing Project Key',
        description: 'Please enter a project key/component',
        status: 'warning',
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
        toast({
          title: 'Connection Successful',
          description: `Connected to SonarQube ${result.server.version}`,
          status: 'success',
          duration: 5000
        })
      } else {
        setConnectionStatus({ success: false, message: result.error })
        toast({
          title: 'Connection Failed',
          description: result.error,
          status: 'error',
          duration: 5000,
          isClosable: true
        })
      }
    } catch (error) {
      setConnectionStatus({ success: false, message: error.message })
      toast({
        title: 'Connection Error',
        description: 'Failed to test connection. Please check your settings.',
        status: 'error',
        duration: 5000,
        isClosable: true
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

      // Store report for preview/download
      setReportBlob(blob)
      setReportData(cleanData)

      // Read first part of HTML for preview
      const text = await blob.text()
      setPreviewHtml(text.substring(0, 5000)) // First 5000 chars for preview

      // Add to report history
      addToReportHistory(cleanData)

      // Show preview modal
      onOpen()

      toast({
        title: 'Report Generated',
        description: 'Preview your report or download it',
        status: 'success',
        duration: 3000
      })
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsGenerating(false)
      setGeneratingStep('')
    }
  }

  const downloadReport = () => {
    if (reportBlob) {
      const url = window.URL.createObjectURL(reportBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sonarhawk-report.html'
      a.click()
      window.URL.revokeObjectURL(url)
      onClose()

      toast({
        title: 'Downloaded',
        description: 'Report saved to your downloads',
        status: 'success',
        duration: 2000
      })
    }
  }

  const openInNewTab = () => {
    if (reportBlob) {
      const url = window.URL.createObjectURL(reportBlob)
      window.open(url, '_blank')
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
              <Tooltip
                label="The base URL of your SonarQube or SonarCloud instance"
                placement="top-start"
                hasArrow
              >
                <FormLabel cursor="help">SonarQube URL</FormLabel>
              </Tooltip>
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
              <Tooltip
                label="The unique identifier for your project in SonarQube (found in project settings)"
                placement="top-start"
                hasArrow
              >
                <FormLabel cursor="help">Project Key / Component</FormLabel>
              </Tooltip>
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

            <Divider />

            {/* Authentication - Token */}
            <FormControl>
              <Tooltip
                label={
                  tokenUrl ? (
                    <VStack spacing={1} align="start">
                      <Text>Generate a token in your SonarQube instance:</Text>
                      <Text fontWeight="bold" color="blue.200">
                        User → My Account → Security → Generate Tokens
                      </Text>
                      <Text fontSize="xs" mt={1}>
                        Or click below to open token page
                      </Text>
                    </VStack>
                  ) : (
                    "Generate a token in SonarQube: User → My Account → Security → Generate Tokens"
                  )
                }
                placement="top-start"
                hasArrow
              >
                <FormLabel cursor="help">Auth Token (Recommended)</FormLabel>
              </Tooltip>
              <Input
                type="password"
                {...register('sonartoken')}
                placeholder="squ_..."
              />
              {tokenUrl ? (
                <Text fontSize="sm" mt={1}>
                  <Link href={tokenUrl} color="blue.500" isExternal textDecoration="underline">
                    Click here to generate a token in your SonarQube instance →
                  </Link>
                </Text>
              ) : (
                <Text fontSize="sm" color="gray.500" mt={1}>
                  SonarQube authentication token
                </Text>
              )}
            </FormControl>

            {/* Alternative Authentication */}
            <Accordion allowToggle>
              <AccordionItem border="none">
                <h2>
                  <AccordionButton px={0}>
                    <Box flex="1" textAlign="left">
                      <Text fontSize="sm" fontWeight="bold" color="gray.600">
                        OR use Username/Password
                      </Text>
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel px={0} pb={4}>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel>Username</FormLabel>
                      <Input {...register('sonarusername')} placeholder="admin" />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Password</FormLabel>
                      <Input type="password" {...register('sonarpassword')} placeholder="••••••••" />
                    </FormControl>

                    <FormControl>
                      <Tooltip
                        label="Required only for SonarCloud.io projects"
                        placement="top-start"
                        hasArrow
                      >
                        <FormLabel cursor="help">Organization (SonarCloud only)</FormLabel>
                      </Tooltip>
                      <Input
                        {...register('sonarorganization')}
                        placeholder="my-org"
                      />
                    </FormControl>
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>

            <Divider />

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

        <Divider />

        {/* Accordion for organized options */}
        <Accordion allowMultiple>

          {/* Project Metadata */}
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">Project Metadata</Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
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
            </AccordionPanel>
          </AccordionItem>

          {/* Scope & Filtering */}
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">Scope & Filtering</Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
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
                  <Tooltip
                    label="Only show issues introduced in the new code period defined in SonarQube"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel mb="0" flex="1" cursor="help">
                      New Code Period Only
                    </FormLabel>
                  </Tooltip>
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
            </AccordionPanel>
          </AccordionItem>

          {/* Report Content */}
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">Report Content</Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
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
            </AccordionPanel>
          </AccordionItem>

          {/* Appearance */}
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">Appearance & Customization</Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
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
            </AccordionPanel>
          </AccordionItem>

          {/* Advanced */}
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">Advanced Options</Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
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
            </AccordionPanel>
          </AccordionItem>

        </Accordion>

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

        <Tooltip
          label={
            <HStack spacing={1}>
              <Text>Press</Text>
              <Kbd>Ctrl</Kbd>
              <Text>+</Text>
              <Kbd>Enter</Kbd>
              <Text>to generate</Text>
            </HStack>
          }
          placement="top"
        >
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
        </Tooltip>
      </VStack>

      {/* Preview Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>Report Preview</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto">
            <VStack spacing={4} align="stretch">
              <Alert status="info">
                <AlertIcon />
                <Text fontSize="sm">
                  This is a preview of your generated report. You can download it or open it in a new tab to view the full interactive version.
                </Text>
              </Alert>

              <Box
                p={4}
                borderWidth="1px"
                borderRadius="md"
                bg="gray.50"
                maxH="500px"
                overflowY="auto"
              >
                <Text fontSize="xs" fontFamily="monospace" whiteSpace="pre-wrap">
                  {previewHtml}
                </Text>
                {previewHtml.length >= 5000 && (
                  <Text fontSize="xs" color="gray.500" mt={2}>
                    ... (Preview truncated. Open in new tab to see full report)
                  </Text>
                )}
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button colorScheme="blue" variant="outline" onClick={openInNewTab}>
                Open in New Tab
              </Button>
              <Button colorScheme="blue" onClick={downloadReport}>
                Download Report
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
