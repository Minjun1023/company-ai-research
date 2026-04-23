type BrandLogoSize = 'hero' | 'panel' | 'compact';

type BrandLogoProps = {
  size?: BrandLogoSize;
  subtitle?: string;
  className?: string;
};

const SIZE_CLASSES: Record<BrandLogoSize, { shell: string; icon: string; subtitle: string; title: string }> = {
  hero: {
    shell: 'rounded-[32px] px-6 py-5 md:px-7 md:py-6',
    icon: 'h-16 w-16 md:h-20 md:w-20',
    subtitle: 'text-[10px] md:text-[11px]',
    title: 'text-[2rem] leading-none md:text-[3.35rem]',
  },
  panel: {
    shell: 'rounded-[26px] px-4 py-4',
    icon: 'h-12 w-12',
    subtitle: 'text-[10px]',
    title: 'text-[1.6rem] leading-none',
  },
  compact: {
    shell: 'rounded-[22px] px-4 py-3',
    icon: 'h-10 w-10',
    subtitle: 'text-[9px]',
    title: 'text-[1.28rem] leading-none',
  },
};

function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brand-logo-gradient" x1="20" y1="14" x2="98" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A8FFD4" />
          <stop offset="0.5" stopColor="#5DFFB1" />
          <stop offset="1" stopColor="#2ECF86" />
        </linearGradient>
      </defs>
      <path
        d="M42 13C23.774 13 9 26.774 9 43.76c0 9.521 4.66 18.017 11.95 23.633L15.983 84l19.836-8.198A37.52 37.52 0 0 0 42 76.52c18.226 0 33-13.774 33-32.76S60.226 13 42 13Z"
        stroke="url(#brand-logo-gradient)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M73.5 28C59.969 28 49 38.219 49 50.82c0 7.027 3.447 13.297 8.837 17.443L54.163 81.5l14.668-6.07c1.523.257 3.083.39 4.669.39 13.531 0 24.5-10.219 24.5-22.82S87.031 28 73.5 28Z"
        stroke="url(#brand-logo-gradient)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BrandLogo({
  size = 'panel',
  subtitle = 'CAREER RESEARCH WORKSPACE',
  className = '',
}: BrandLogoProps) {
  const styles = SIZE_CLASSES[size];

  return (
    <div className={`brand-logo-shell ${styles.shell} ${className}`.trim()}>
      <div className="flex items-center gap-3 md:gap-4">
        <div className={`brand-logo-mark ${styles.icon}`}>
          <BrandMark className="h-full w-full" />
        </div>
        <div className="min-w-0">
          <p className={`brand-logo-subtitle ${styles.subtitle}`}>{subtitle}</p>
          <p className={`brand-logo-title ${styles.title}`}>ChatCompany</p>
        </div>
      </div>
    </div>
  );
}
