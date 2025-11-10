import { Box, Heading, Text, Icon, IconButton, useColorMode, HStack, Tooltip, Button } from '@chakra-ui/react'
import { FaChartBar, FaMoon, FaSun, FaEye } from 'react-icons/fa'

export function Header() {
  const { colorMode, toggleColorMode } = useColorMode()

  const openDemoReport = () => {
    const apiUrl = import.meta.env.PROD
      ? '/api/demo'
      : 'http://localhost:3000/api/demo'

    window.open(apiUrl, '_blank')
  }

  return (
    <Box textAlign="center" width="100%" position="relative">
      <HStack justify="flex-end" position="absolute" top={0} right={0}>
        <Tooltip label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`} placement="left">
          <IconButton
            aria-label="Toggle color mode"
            icon={colorMode === 'dark' ? <FaSun /> : <FaMoon />}
            onClick={toggleColorMode}
            variant="ghost"
            size="md"
          />
        </Tooltip>
      </HStack>
      <Icon as={FaChartBar} w={10} h={10} color="blue.500" mb={2} />
      <Heading size="xl" mb={2}>CodeGuard</Heading>
      <Text fontSize="lg" color="gray.500" mb={4}>
        Advanced Security Reporting & Vulnerability Management
      </Text>
      <Button
        leftIcon={<FaEye />}
        variant="outline"
        colorScheme="blue"
        size="sm"
        onClick={openDemoReport}
      >
        View Demo Report
      </Button>
    </Box>
  )
}
