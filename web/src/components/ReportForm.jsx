import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  VStack,
  useToast
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'

export function ReportForm() {
  const { register, handleSubmit } = useForm()
  const toast = useToast()

  const onSubmit = async (data) => {
    try {
      console.log('Sending request to API...');
      const response = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to generate report')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sonarhawk-report.html'
      a.click()

      toast({
        title: 'Report Generated',
        status: 'success',
        duration: 3000
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000
      })
    }
  }

  return (
    <Box as="form" onSubmit={handleSubmit(onSubmit)} width="100%" maxW="600px">
      <VStack spacing={4} align="stretch">
        <FormControl isRequired>
          <FormLabel>SonarQube URL</FormLabel>
          <Input {...register('sonarurl')} placeholder="https://sonar.company.com" />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Project Key</FormLabel>
          <Input {...register('sonarcomponent')} placeholder="project:key" />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Auth Token</FormLabel>
          <Input type="password" {...register('sonartoken')} />
        </FormControl>

        <FormControl>
          <FormLabel>Branch</FormLabel>
          <Input {...register('branch')} placeholder="master" />
        </FormControl>

        <FormControl display="flex" alignItems="center">
          <FormLabel mb="0">
            Use Dark Theme
          </FormLabel>
          <Switch {...register('darkTheme')} defaultChecked />
        </FormControl>

        <FormControl display="flex" alignItems="center">
          <FormLabel mb="0">
            Include Quality Gates
          </FormLabel>
          <Switch {...register('qualityGateStatus')} />
        </FormControl>

        <FormControl display="flex" alignItems="center">
          <FormLabel mb="0">
            Include Coverage
          </FormLabel>
          <Switch {...register('coverage')} />
        </FormControl>

        <Button type="submit" colorScheme="blue" size="lg">
          Generate Report
        </Button>
      </VStack>
    </Box>
  )
}
