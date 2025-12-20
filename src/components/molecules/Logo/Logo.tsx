import Link from 'next/link';
import { cn } from '@/libs/utils';

interface LogoProps {
  width?: number;
  height?: number;
  noLink?: boolean;
  className?: string;
}

export function Logo({ width = 40, height = 40, noLink = false, className }: LogoProps) {
  const logoImage = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.2"
      viewBox="0 0 690 690"
      className={cn('text-brand', className)}
      width={width}
      height={height}
      style={{ width: `${width}px`, height: `${height}px` }}
      aria-label="Pubky"
    >
      <g transform="translate(119, 0)">
        <path
          fillRule="evenodd"
          d="m.1 84.7 80.5 17.1 15.8-74.5 73.8 44.2L224.9 0l55.2 71.5 70.3-44.2 19.4 74.5 81.6-17.1-74.5 121.5c-40.5-35.3-93.5-56.6-151.4-56.6-57.8 0-110.7 21.3-151.2 56.4zm398.4 293.8c0 40.6-14 78-37.4 107.4l67 203.8H25l66.2-202.3c-24.1-29.7-38.6-67.6-38.6-108.9 0-95.5 77.4-172.8 173-172.8 95.5 0 172.9 77.3 172.9 172.8zm-212.9 82.4-48.2 147.3h178.1l-48.6-148 2.9-1.6c28.2-15.6 47.3-45.6 47.3-80.1 0-50.5-41-91.4-91.5-91.4-50.6 0-91.6 40.9-91.6 91.4 0 35 19.7 65.4 48.6 80.8z"
          fill="currentColor"
        />
      </g>
    </svg>
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
