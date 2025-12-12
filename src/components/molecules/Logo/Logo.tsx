import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/libs/utils';

interface LogoProps {
  width?: number;
  height?: number;
  noLink?: boolean;
  className?: string;
}

export function Logo({
  width = 109,
  height = 36,
  noLink = false,
  className,
}: LogoProps) {
  const logoImage = (
    <Image
      src="/pubky-logo.svg"
      alt="Pubky"
      className={cn('w-auto h-auto -mt-1', className)}
      width={width}
      height={height}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );

  return !noLink ? (
    <Link
      href="/"
      className={cn('flex items-center', className)}
      style={{ minWidth: `${width}px`, minHeight: `${height}px` }}
    >
      {logoImage}
    </Link>
  ) : (
    <div className={cn('flex items-center', className)} style={{ minWidth: `${width}px`, minHeight: `${height}px` }}>
      {logoImage}
    </div>
  );
}

