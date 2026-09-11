import React from 'react';
import Image from 'next/image';
import { Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
  showText?: boolean;
  textClassName?: string;
  /**
   * Optional path to custom logo asset (e.g., '/logo.svg' or '/logo.png').
   * If not provided, renders the stylized SVG icon wrapper.
   */
  logoSrc?: string;
}

export function BrandLogo({
  className,
  size = 'md',
  theme = 'dark',
  showText = true,
  textClassName,
  logoSrc,
}: BrandLogoProps) {
  const iconSizeMap = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const dropletSizeMap = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const textSizeMap = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const isLight = theme === 'light';

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      {/* Logo container: drop-in ready for image or custom vector */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-xl p-[1px] shrink-0 transition-transform duration-300 group-hover:scale-105',
          iconSizeMap[size],
          isLight
            ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-sm'
            : 'bg-gradient-to-tr from-blue-600 via-cyan-500 to-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.35)]'
        )}
      >
        {logoSrc ? (
          <div className="relative w-full h-full overflow-hidden rounded-[11px]">
            <Image
              src={logoSrc}
              alt="FlowLoop OS Logo"
              fill
              className="object-contain p-1"
              priority
            />
          </div>
        ) : (
          <div
            className={cn(
              'w-full h-full rounded-[11px] flex items-center justify-center',
              isLight ? 'bg-white' : 'bg-[#05080B]'
            )}
          >
            <Droplets
              className={cn(
                dropletSizeMap[size],
                isLight ? 'text-cyan-600' : 'text-cyan-400',
                'transition-transform duration-300 group-hover:scale-110'
              )}
            />
          </div>
        )}
      </div>

      {showText && (
        <span
          className={cn(
            'font-sans font-bold tracking-tight',
            textSizeMap[size],
            isLight ? 'text-neutral-900' : 'text-white',
            textClassName
          )}
        >
          FlowLoop{' '}
          <span className={isLight ? 'text-cyan-600' : 'text-cyan-400'}>OS</span>
        </span>
      )}
    </div>
  );
}
