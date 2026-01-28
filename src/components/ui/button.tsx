import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/libs/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border text-sm font-semibold shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-brand/16 text-brand border-brand hover:bg-brand/30 focus-visible:ring-brand/30',
        destructive:
          'bg-destructive/60 text-destructive-foreground border-destructive hover:bg-destructive/90 focus-visible:ring-destructive/30',
        outline:
          'bg-input/30 text-foreground border-input hover:bg-input/50 hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground border-secondary-foreground/40 hover:bg-secondary/80',
        ghost:
          'border-transparent hover:bg-accent hover:text-accent-foreground hover:bg-accent/50',
        link: 'border-transparent text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-auto min-h-10 px-6 py-2.5 sm:px-8 sm:py-3',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
