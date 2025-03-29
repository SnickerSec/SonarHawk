import { extendTheme } from '@chakra-ui/react'

export const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'white'
      }
    }
  }
})
