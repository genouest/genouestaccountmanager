import { definePreset } from '@openng/optimus-ui-themes';
import Lara from '@openng/optimus-ui-themes/lara';

export const Preset = definePreset(Lara, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}'
    }
  },
  components: {
    button: {
      colorScheme: {
        light: {
          root: {
            warn: {
              background: '{yellow.600}',
              borderColor: '{yellow.600}',
              hoverBackground: '{yellow.700}',
              hoverBorderColor: '{yellow.700}'
            },
            secondary: {
              color: '{button.root.primary.color}',
              background: '{button.root.primary.background}',
              borderColor: '{button.root.primary.borderColor}',
              hoverBackground: '{button.root.primary.hoverBackground}',
              hoverBorderColor: '{button.root.primary.hoverBorderColor}',
            }
          }
        }
      }
    }
  }
});
