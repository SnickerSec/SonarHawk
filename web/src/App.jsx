import { ChakraProvider, Container, VStack } from '@chakra-ui/react'
import { ReportForm } from './components/ReportForm'
import { Header } from './components/Header'
import { theme } from './theme'

export function App() {
  return (
    <ChakraProvider theme={theme}>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8}>
          <Header />
          <ReportForm />
        </VStack>
      </Container>
    </ChakraProvider>
  )
}
