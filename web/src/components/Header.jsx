import { Box, Heading, Text, Icon, IconButton, useColorMode, HStack, Tooltip } from '@chakra-ui/react'
import { FaChartBar, FaMoon, FaSun } from 'react-icons/fa'

export function Header() {
  const { colorMode, toggleColorMode } = useColorMode()

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
      <Heading size="xl" mb={2}>SonarHawk</Heading>
      <Text fontSize="lg" color="gray.500">
        Generate enhanced SonarQube vulnerability reports
      </Text>
    </Box>
  )
}
