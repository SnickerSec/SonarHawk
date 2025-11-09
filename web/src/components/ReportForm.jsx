import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  VStack,
  useToast,
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
  Divider
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'

export function ReportForm() {
  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      darkTheme: true
    }
  })
  const toast = useToast()

  const onSubmit = async (data) => {
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

      const apiUrl = import.meta.env.PROD
        ? '/api/generate'
        : 'http://localhost:3000/api/generate'

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(cleanData)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate report' }))
        throw new Error(error.error || 'Failed to generate report')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sonarhawk-report.html'
      a.click()

      toast({
        title: 'Report Generated',
        description: 'Your report has been downloaded successfully',
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
    }
  }

  return (
    <Box as="form" onSubmit={handleSubmit(onSubmit)} width="100%" maxW="800px">
      <VStack spacing={6} align="stretch">

        {/* Required Fields */}
        <Box>
          <Heading size="md" mb={4}>Required Configuration</Heading>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>SonarQube URL</FormLabel>
              <Input
                {...register('sonarurl')}
                placeholder="https://sonar.company.com"
                type="url"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Project Key / Component</FormLabel>
              <Input
                {...register('sonarcomponent')}
                placeholder="project:key"
              />
              <Text fontSize="sm" color="gray.500" mt={1}>
                The SonarQube component/project key to analyze
              </Text>
            </FormControl>
          </VStack>
        </Box>

        <Divider />

        {/* Accordion for organized options */}
        <Accordion allowMultiple>

          {/* Authentication */}
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">Authentication</Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
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

        <Button
          type="submit"
          colorScheme="blue"
          size="lg"
          width="100%"
        >
          Generate Report
        </Button>
      </VStack>
    </Box>
  )
}
