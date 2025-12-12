import { Field as ChakraField } from '@chakra-ui/react';
import { forwardRef } from 'react';

export const Field = forwardRef(function Field(props, ref) {
  const { label, children, helperText, errorText, optionalText, ...rest } = props;
  return (
    <ChakraField.Root ref={ref} {...rest}>
      {label && (
        <ChakraField.Label>
          {label}
          {optionalText && <ChakraField.RequiredIndicator />}
        </ChakraField.Label>
      )}
      {children}
      {helperText && (
        <ChakraField.HelperText>{helperText}</ChakraField.HelperText>
      )}
      {errorText && (
        <ChakraField.ErrorText>{errorText}</ChakraField.ErrorText>
      )}
    </ChakraField.Root>
  );
});

// Aliases for backward compatibility
export const FormControl = Field;
export const FormLabel = ChakraField.Label;
export const FormHelperText = ChakraField.HelperText;
export const FormErrorMessage = ChakraField.ErrorText;
