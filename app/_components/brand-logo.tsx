import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  size?: "compact" | "default";
};

const brandLogoSizes = {
  compact: {
    className: "size-8 rounded-[7px]",
    dimension: 32,
  },
  default: {
    className: "size-10 rounded-lg",
    dimension: 40,
  },
} as const;

export function BrandLogo({ className, size = "default" }: BrandLogoProps) {
  const logoSize = brandLogoSizes[size];

  return (
    <Image
      src="/xmetapay-logo.jpg"
      alt=""
      width={logoSize.dimension}
      height={logoSize.dimension}
      loading="eager"
      className={cn(
        "shrink-0 object-cover shadow-sm",
        logoSize.className,
        className,
      )}
      data-brand-logo
    />
  );
}
