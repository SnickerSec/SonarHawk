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
  Link,
  InputGroup,
  InputLeftAddon
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import { useState, useEffect } from 'react'
import { addToReportHistory } from './ReportHistory'

export function ReportForm() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      darkTheme: true,
      includeCompliance: true,
      saveTrendData: true,
      includeTrends: false
    }
  })
  const toast = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [reachabilityStatus, setReachabilityStatus] = useState(null)
  const [authStatus, setAuthStatus] = useState(null)
  const [projectStatus, setProjectStatus] = useState(null)
  const [generatingStep, setGeneratingStep] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const [reportBlob, setReportBlob] = useState(null)
  const [reportData, setReportData] = useState(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [isCheckingReachability, setIsCheckingReachability] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)
  const [isCheckingProject, setIsCheckingProject] = useState(false)

  // Watch SonarQube URL for dynamic token link
  const sonarUrl = watch('sonarurl')
  const sonarComponent = watch('sonarcomponent')
  const sonarToken = watch('sonartoken')
  const sonarUsername = watch('sonarusername')
  const sonarPassword = watch('sonarpassword')

  // Generate full URL from input (adds https:// if not present)
  const getFullUrl = (url) => {
    if (!url) return null
    const trimmed = url.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed
    }
    return `https://${trimmed}`
  }

  const fullSonarUrl = getFullUrl(sonarUrl)

  // Generate token URL based on user's SonarQube instance
  const getTokenUrl = () => {
    if (!fullSonarUrl) return null
    try {
      const baseUrl = fullSonarUrl.replace(/\/+$/, '') // Remove trailing slashes
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

  // Basic reachability check (just tests if server responds)
  const checkReachability = async (url) => {
    if (!url) return

    setIsCheckingReachability(true)
    setReachabilityStatus(null)

    try {
      const apiUrl = import.meta.env.PROD
        ? '/api/test-connection'
        : 'http://localhost:3000/api/test-connection'

      const testUrl = getFullUrl(url)

      // Simple check - just test if server responds
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sonarurl: testUrl,
          sonarcomponent: 'test' // Dummy component for reachability check
        })
      })

      const result = await response.json()

      // Even if project doesn't exist, if we get server version, it's reachable
      if (result.success || (result.error && !result.error.includes('reach'))) {
        setReachabilityStatus({
          reachable: true,
          version: result.server?.version
        })
      } else {
        setReachabilityStatus({
          reachable: false,
          error: result.error
        })
      }
    } catch (error) {
      setReachabilityStatus({
        reachable: false,
        error: 'Unable to reach server'
      })
    } finally {
      setIsCheckingReachability(false)
    }
  }

  // Validate authentication credentials
  const validateAuth = async () => {
    if (!sonarUrl) return

    const hasAuth = sonarToken || (sonarUsername && sonarPassword)
    if (!hasAuth) {
      setAuthStatus(null)
      return
    }

    setIsCheckingAuth(true)
    setAuthStatus(null)

    try {
      const apiUrl = import.meta.env.PROD
        ? '/api/test-connection'
        : 'http://localhost:3000/api/test-connection'

      const testUrl = getFullUrl(sonarUrl)

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sonarurl: testUrl,
          sonarcomponent: 'test', // Dummy for auth check
          sonartoken: sonarToken,
          sonarusername: sonarUsername,
          sonarpassword: sonarPassword
        })
      })

      const result = await response.json()

      // Check if auth succeeded
      if (result.success || (result.error && !result.error.includes('Authentication') && !result.error.includes('credentials'))) {
        setAuthStatus({
          valid: true
        })
      } else if (result.error && (result.error.includes('Authentication') || result.error.includes('credentials'))) {
        setAuthStatus({
          valid: false,
          error: result.error
        })
      }
    } catch (error) {
      setAuthStatus({
        valid: false,
        error: 'Unable to validate credentials'
      })
    } finally {
      setIsCheckingAuth(false)
    }
  }

  // Validate project key
  const validateProject = async () => {
    if (!sonarUrl || !sonarComponent) {
      setProjectStatus(null)
      return
    }

    setIsCheckingProject(true)
    setProjectStatus(null)

    try {
      const apiUrl = import.meta.env.PROD
        ? '/api/test-connection'
        : 'http://localhost:3000/api/test-connection'

      const testUrl = getFullUrl(sonarUrl)

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sonarurl: testUrl,
          sonarcomponent: sonarComponent,
          sonartoken: sonarToken,
          sonarusername: sonarUsername,
          sonarpassword: sonarPassword
        })
      })

      const result = await response.json()

      if (result.success) {
        setProjectStatus({
          valid: true,
          version: result.server?.version
        })
      } else if (result.error && result.error.includes('not found')) {
        setProjectStatus({
          valid: false,
          error: 'Project not found'
        })
      } else if (result.error && result.error.includes('Access denied')) {
        setProjectStatus({
          valid: false,
          error: 'Access denied to project'
        })
      }
    } catch (error) {
      setProjectStatus({
        valid: false,
        error: 'Unable to validate project'
      })
    } finally {
      setIsCheckingProject(false)
    }
  }

  // Auto-check reachability when URL changes (doesn't need project key)
  useEffect(() => {
    // Need at least a domain name
    if (!sonarUrl || sonarUrl.trim().length < 3) {
      setReachabilityStatus(null)
      return
    }

    // Debounce the reachability check
    const timeoutId = setTimeout(() => {
      if (sonarUrl && !isCheckingReachability && !isGenerating) {
        checkReachability(sonarUrl)
      }
    }, 1000) // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId)
  }, [sonarUrl])

  // Auto-check auth when credentials change
  useEffect(() => {
    // Need URL and credentials
    if (!sonarUrl || (!sonarToken && !(sonarUsername && sonarPassword))) {
      setAuthStatus(null)
      return
    }

    // Only check if server is reachable
    if (!reachabilityStatus?.reachable) return

    const timeoutId = setTimeout(() => {
      if (!isCheckingAuth && !isGenerating) {
        validateAuth()
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [sonarUrl, sonarToken, sonarUsername, sonarPassword, reachabilityStatus])

  // Auto-check project when component changes
  useEffect(() => {
    // Need both URL and component
    if (!sonarUrl || !sonarComponent) {
      setProjectStatus(null)
      return
    }

    // Only check if server is reachable
    if (!reachabilityStatus?.reachable) return

    const timeoutId = setTimeout(() => {
      if (!isCheckingProject && !isGenerating) {
        validateProject()
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [sonarUrl, sonarComponent, sonarToken, sonarUsername, sonarPassword, reachabilityStatus])


  // Keyboard shortcuts: Ctrl+Enter (or Cmd+Enter on Mac) to submit
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        if (!isGenerating) {
          handleSubmit(onSubmit)()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isGenerating, handleSubmit])

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

      // Add https:// prefix to URL if not present
      if (cleanData.sonarurl) {
        cleanData.sonarurl = getFullUrl(cleanData.sonarurl)
      }

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
      a.download = 'codeguard-report.html'
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

  const downloadAsPDF = () => {
    if (reportBlob) {
      // Open report in new window and trigger PDF export
      const url = window.URL.createObjectURL(reportBlob)
      const newWindow = window.open(url, '_blank')

      // Wait for the window to load, then trigger PDF export
      if (newWindow) {
        newWindow.addEventListener('load', () => {
          setTimeout(() => {
            // The report page has an exportToPDF function
            if (newWindow.exportToPDF) {
              newWindow.exportToPDF()
            } else {
              // Fallback: show instructions
              toast({
                title: 'PDF Export',
                description: 'Click the "Export to PDF" button in the opened report, or press Ctrl/Cmd+P',
                status: 'info',
                duration: 5000,
                isClosable: true
              })
            }
          }, 1000)
        })
      }
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
              <HStack justify="space-between">
                <Tooltip
                  label="The domain of your SonarQube or SonarCloud instance (https:// is automatically added)"
                  placement="top-start"
                  hasArrow
                >
                  <FormLabel cursor="help">SonarQube URL</FormLabel>
                </Tooltip>
                {isCheckingReachability && (
                  <HStack spacing={1}>
                    <Spinner size="xs" />
                    <Text fontSize="xs" color="gray.500">Checking reachability...</Text>
                  </HStack>
                )}
                {!isCheckingReachability && reachabilityStatus && (
                  <Tooltip
                    label={
                      reachabilityStatus.reachable
                        ? `Server reachable${reachabilityStatus.version ? ` (v${reachabilityStatus.version})` : ''}`
                        : reachabilityStatus.error
                    }
                    placement="top"
                  >
                    <Badge colorScheme={reachabilityStatus.reachable ? 'green' : 'red'} fontSize="xs">
                      {reachabilityStatus.reachable ? '✓ Reachable' : '✗ Unreachable'}
                    </Badge>
                  </Tooltip>
                )}
              </HStack>
              <InputGroup>
                <InputLeftAddon>https://</InputLeftAddon>
                <Input
                  {...register('sonarurl', {
                    required: 'SonarQube URL is required',
                    minLength: {
                      value: 3,
                      message: 'Please enter a valid domain'
                    }
                  })}
                  placeholder="sonarqube.example.com"
                  type="text"
                />
              </InputGroup>
              {errors.sonarurl && (
                <FormErrorMessage>{errors.sonarurl.message}</FormErrorMessage>
              )}
              {reachabilityStatus && !reachabilityStatus.reachable && (
                <Text fontSize="xs" color="red.500" mt={1}>
                  ⚠️ {reachabilityStatus.error || 'Server is not reachable. Please check the URL and network connection.'}
                </Text>
              )}
              {reachabilityStatus && reachabilityStatus.reachable && reachabilityStatus.version && (
                <Text fontSize="xs" color="green.500" mt={1}>
                  ✓ Connected to SonarQube {reachabilityStatus.version}
                </Text>
              )}
            </FormControl>

            <FormControl isRequired isInvalid={errors.sonarcomponent}>
              <HStack justify="space-between">
                <Tooltip
                  label="The unique identifier for your project in SonarQube (found in project settings)"
                  placement="top-start"
                  hasArrow
                >
                  <FormLabel cursor="help">Project Key / Component</FormLabel>
                </Tooltip>
                {isCheckingProject && (
                  <HStack spacing={1}>
                    <Spinner size="xs" />
                    <Text fontSize="xs" color="gray.500">Validating...</Text>
                  </HStack>
                )}
                {!isCheckingProject && projectStatus && (
                  <Tooltip
                    label={projectStatus.valid ? 'Project found and accessible' : projectStatus.error}
                    placement="top"
                  >
                    <Badge colorScheme={projectStatus.valid ? 'green' : 'red'} fontSize="xs">
                      {projectStatus.valid ? '✓ Valid' : '✗ Invalid'}
                    </Badge>
                  </Tooltip>
                )}
              </HStack>
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
              ) : projectStatus && !projectStatus.valid ? (
                <Text fontSize="xs" color="red.500" mt={1}>
                  ⚠️ {projectStatus.error}
                </Text>
              ) : projectStatus && projectStatus.valid ? (
                <Text fontSize="xs" color="green.500" mt={1}>
                  ✓ Project found and accessible
                </Text>
              ) : (
                <Text fontSize="sm" color="gray.500" mt={1}>
                  The SonarQube component/project key to analyze
                </Text>
              )}
            </FormControl>

            <Divider />

            {/* Authentication - Token */}
            <FormControl>
              <HStack justify="space-between">
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
                {isCheckingAuth && (
                  <HStack spacing={1}>
                    <Spinner size="xs" />
                    <Text fontSize="xs" color="gray.500">Validating...</Text>
                  </HStack>
                )}
                {!isCheckingAuth && authStatus && (
                  <Tooltip
                    label={authStatus.valid ? 'Authentication successful' : authStatus.error}
                    placement="top"
                  >
                    <Badge colorScheme={authStatus.valid ? 'green' : 'red'} fontSize="xs">
                      {authStatus.valid ? '✓ Valid' : '✗ Invalid'}
                    </Badge>
                  </Tooltip>
                )}
              </HStack>
              <Input
                type="password"
                {...register('sonartoken')}
                placeholder="squ_..."
              />
              {authStatus && !authStatus.valid ? (
                <Text fontSize="xs" color="red.500" mt={1}>
                  ⚠️ {authStatus.error}
                </Text>
              ) : authStatus && authStatus.valid ? (
                <Text fontSize="xs" color="green.500" mt={1}>
                  ✓ Authentication successful
                </Text>
              ) : tokenUrl ? (
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

          </VStack>
        </Box>

        <Divider />

        {/* Accordion for organized options */}
        <Accordion allowMultiple defaultIndex={[0]}>

          {/* Popular Options */}
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <HStack spacing={2}>
                    <Heading size="sm">Popular Options</Heading>
                    <Badge colorScheme="blue" fontSize="xs">Most Used</Badge>
                  </HStack>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <VStack spacing={4}>
                <FormControl>
                  <Tooltip
                    label="Analyze a specific branch instead of the main branch"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel cursor="help">Branch</FormLabel>
                  </Tooltip>
                  <Input
                    {...register('branch')}
                    placeholder="main"
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Leave empty for default branch
                  </Text>
                </FormControl>

                <FormControl>
                  <Tooltip
                    label="Generate report for a specific pull request"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel cursor="help">Pull Request ID</FormLabel>
                  </Tooltip>
                  <Input
                    {...register('pullrequest')}
                    placeholder="123"
                    type="number"
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Tooltip
                    label="Show pass/fail status from SonarQube quality gates"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel mb="0" flex="1" cursor="help">
                      Include Quality Gate Status
                    </FormLabel>
                  </Tooltip>
                  <Switch {...register('qualityGateStatus')} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Tooltip
                    label="Include code coverage metrics in the report"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel mb="0" flex="1" cursor="help">
                      Include Code Coverage
                    </FormLabel>
                  </Tooltip>
                  <Switch {...register('coverage')} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Tooltip
                    label="Add clickable links to issues in your SonarQube instance"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel mb="0" flex="1" cursor="help">
                      Link Issues to SonarQube
                    </FormLabel>
                  </Tooltip>
                  <Switch {...register('linkIssues')} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Tooltip
                    label="Use dark theme for the generated report (recommended)"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel mb="0" flex="1" cursor="help">
                      Dark Theme Report
                    </FormLabel>
                  </Tooltip>
                  <Switch {...register('darkTheme')} defaultChecked />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Tooltip
                    label="Include compliance section showing OWASP Top 10, CWE, and SANS categorization for security audits"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel mb="0" flex="1" cursor="help">
                      Compliance View (OWASP/CWE)
                    </FormLabel>
                  </Tooltip>
                  <Switch {...register('includeCompliance')} defaultChecked />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Tooltip
                    label="Track vulnerability trends over time and show improvement deltas (requires multiple report runs)"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel mb="0" flex="1" cursor="help">
                      Trend Analysis
                    </FormLabel>
                  </Tooltip>
                  <Switch {...register('saveTrendData')} defaultChecked />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Tooltip
                    label="Show historical trends and charts in the report (requires saved trend data)"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel mb="0" flex="1" cursor="help">
                      Include Trend Charts
                    </FormLabel>
                  </Tooltip>
                  <Switch {...register('includeTrends')} />
                </FormControl>
              </VStack>
            </AccordionPanel>
          </AccordionItem>

          {/* Notifications */}
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">Notifications</Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <VStack spacing={4}>
                <FormControl>
                  <Tooltip
                    label="Send security report summary to Slack channel using an Incoming Webhook"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel cursor="help">Slack Webhook URL</FormLabel>
                  </Tooltip>
                  <Input
                    {...register('slackWebhook')}
                    placeholder="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
                    type="url"
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Get webhook URL from:{' '}
                    <Link href="https://api.slack.com/messaging/webhooks" isExternal color="blue.500">
                      api.slack.com/messaging/webhooks
                    </Link>
                  </Text>
                </FormControl>

                <FormControl>
                  <Tooltip
                    label="Only send Slack notification if high severity issues are greater than or equal to this threshold (prevents spam)"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel cursor="help">Notification Threshold</FormLabel>
                  </Tooltip>
                  <Input
                    {...register('slackThreshold', {
                      valueAsNumber: true
                    })}
                    placeholder="0"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Minimum high severity issues to trigger notification (0 = always notify)
                  </Text>
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Tooltip
                    label="Enable this to send Slack notifications when reports are generated"
                    placement="top-start"
                    hasArrow
                  >
                    <FormLabel mb="0" flex="1" cursor="help">
                      Enable Slack Notifications
                    </FormLabel>
                  </Tooltip>
                  <Switch {...register('enableSlack')} />
                </FormControl>
              </VStack>
            </AccordionPanel>
          </AccordionItem>

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
            isDisabled={isGenerating}
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
              <Button colorScheme="purple" variant="outline" onClick={downloadAsPDF}>
                📄 Download as PDF
              </Button>
              <Button colorScheme="blue" onClick={downloadReport}>
                Download HTML
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
