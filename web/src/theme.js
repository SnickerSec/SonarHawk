import { extendTheme } from '@chakra-ui/react'

export const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: true, // Respect user's system preference
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'gray.50',
        color: props.colorMode === 'dark' ? 'white' : 'gray.800'
      }
    })
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'blue'
      }
    },
    Input: {
      variants: {
        outline: {
          field: {
            _focus: {
              borderColor: 'blue.500',
              boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)'
            }
          }
        }
      }
    }
  }
})
