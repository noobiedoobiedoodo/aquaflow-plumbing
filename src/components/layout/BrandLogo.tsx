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
  variant?: 'icon' | 'full';
  /**
   * Optional custom image path override.
   */
  logoSrc?: string;
}

export function BrandLogo({
  className,
  size = 'md',
  theme = 'dark',
  showText = true,
  textClassName,
  variant = 'icon',
  logoSrc,
}: BrandLogoProps) {
  const iconSizeMap = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const fullSizeMap = {
    sm: 'h-7 w-auto',
    md: 'h-9 w-auto',
    lg: 'h-12 w-auto',
  };

  const textSizeMap = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const isLight = theme === 'light';

  // If full lockup variant requested
  if (variant === 'full') {
    const fullSrc = logoSrc || (isLight ? '/brand/flowloop-logo.png' : '/brand/flowloop-logo-white.png');
    return (
      <div className={cn('relative inline-flex items-center select-none', className)}>
        <Image
          src={fullSrc}
          alt="FlowLoop OS"
          width={280}
          height={53}
          className={cn('object-contain', fullSizeMap[size])}
          priority
        />
      </div>
    );
  }

  const effectiveIconSrc = logoSrc || '/brand/flowloop-icon.png';

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      {/* Logo container: structured with drop-in transparent asset */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-xl p-[1px] shrink-0 transition-transform duration-300 group-hover:scale-105',
          iconSizeMap[size],
          isLight
            ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-sm'
            : 'bg-gradient-to-tr from-blue-600 via-cyan-500 to-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.35)]'
        )}
      >
        <div className="relative w-full h-full overflow-hidden rounded-[11px]">
          <Image
            src={effectiveIconSrc}
            alt="FlowLoop OS Icon"
            fill
            className="object-contain p-1"
            priority
          />
        </div>
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
