import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  IconButton,
  Heading,
  Separator,
  Tooltip,
} from '@chakra-ui/react'
import { useColorModeValue } from './ui/color-mode'
import { FaTrash, FaClock } from 'react-icons/fa'
import { useState, useEffect } from 'react'

const MAX_HISTORY = 10

export function ReportHistory() {
  const [history, setHistory] = useState([])
  const bgColor = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const hoverBg = useColorModeValue('gray.50', 'gray.700')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem('codeguard_report_history')
      if (stored) {
        setHistory(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load report history:', error)
    }
  }

  const clearHistory = () => {
    localStorage.removeItem('codeguard_report_history')
    setHistory([])
  }

  const removeItem = (timestamp) => {
    const updated = history.filter(item => item.timestamp !== timestamp)
    localStorage.setItem('codeguard_report_history', JSON.stringify(updated))
    setHistory(updated)
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  if (history.length === 0) {
    return null
  }

  return (
    <Box
      width="100%"
      maxW="800px"
      bg={bgColor}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      p={6}
    >
      <HStack justify="space-between" mb={4}>
        <HStack spacing={2}>
          <FaClock />
          <Heading size="md">Recent Reports</Heading>
          <Badge colorScheme="blue">{history.length}</Badge>
        </HStack>
        {history.length > 0 && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <IconButton
                aria-label="Clear history"
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={clearHistory}
              >
                <FaTrash />
              </IconButton>
            </Tooltip.Trigger>
            <Tooltip.Positioner>
              <Tooltip.Content>Clear all history</Tooltip.Content>
            </Tooltip.Positioner>
          </Tooltip.Root>
        )}
      </HStack>

      <Separator mb={4} />

      <VStack spacing={3} align="stretch">
        {history.map((item) => (
          <HStack
            key={item.timestamp}
            justify="space-between"
            p={3}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="md"
            _hover={{ bg: hoverBg }}
          >
            <VStack align="start" spacing={1} flex="1">
              <HStack spacing={2}>
                <Text fontWeight="bold" fontSize="sm">
                  {item.project || item.component}
                </Text>
                {item.branch && (
                  <Badge colorScheme="purple" fontSize="xs">
                    {item.branch}
                  </Badge>
                )}
                {item.pullRequest && (
                  <Badge colorScheme="green" fontSize="xs">
                    PR #{item.pullRequest}
                  </Badge>
                )}
              </HStack>
              <Text fontSize="xs" color="gray.500">
                {item.url} • {formatDate(item.timestamp)}
              </Text>
            </VStack>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <IconButton
                  aria-label="Remove"
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => removeItem(item.timestamp)}
                >
                  <FaTrash />
                </IconButton>
              </Tooltip.Trigger>
              <Tooltip.Positioner>
                <Tooltip.Content>Remove from history</Tooltip.Content>
              </Tooltip.Positioner>
            </Tooltip.Root>
          </HStack>
        ))}
      </VStack>
    </Box>
  )
}

// Helper function to add report to history (export for use in ReportForm)
export const addToReportHistory = (reportData) => {
  try {
    const stored = localStorage.getItem('codeguard_report_history')
    const history = stored ? JSON.parse(stored) : []

    const newEntry = {
      timestamp: Date.now(),
      url: reportData.sonarurl,
      component: reportData.sonarcomponent,
      project: reportData.project,
      branch: reportData.branch,
      pullRequest: reportData.pullrequest
    }

    // Add to beginning and limit to MAX_HISTORY
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY)
    localStorage.setItem('codeguard_report_history', JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to save to report history:', error)
  }
}
