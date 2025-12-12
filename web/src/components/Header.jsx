import { Box, Heading, Text, HStack, Icon } from '@chakra-ui/react';
import { FiShield } from 'react-icons/fi';

export function Header() {
  return (
    <Box textAlign="center">
      <HStack justify="center" mb={2}>
        <Icon as={FiShield} w={10} h={10} color="blue.500" />
        <Heading size="xl">SonarHawk</Heading>
      </HStack>
      <Text fontSize="lg" color="gray.500">
        Track, analyze, and manage SonarQube security findings
      </Text>
    </Box>
  );
}
