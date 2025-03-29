import { Box, Heading, Text, Icon } from '@chakra-ui/react'
import { FaChartBar } from 'react-icons/fa'

export function Header() {
  return (
    <Box textAlign="center">
      <Icon as={FaChartBar} w={10} h={10} color="blue.500" mb={2} />
      <Heading size="xl" mb={2}>SonarHawk</Heading>
      <Text fontSize="lg" color="gray.500">
        Generate enhanced SonarQube vulnerability reports
      </Text>
    </Box>
  )
}
