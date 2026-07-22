import { Link } from "react-router-dom";

interface BrandLogoProps {
  className?: string;
  linkToHome?: boolean;
  light?: boolean;
}

export default function BrandLogo({
  className = "h-14 w-auto max-w-[250px]",
  linkToHome = true,
  light = false,
}: BrandLogoProps) {
  const logo = (
    <img
      src="/secured-landing-logo-transparent.png"
      alt="Secured Landing — Land-Backed Lending"
      className={`${className} object-contain [image-rendering:auto] ${
        light ? "drop-shadow-sm" : ""
      }`}
      decoding="async"
      loading="eager"
      draggable={false}
    />
  );

  return linkToHome ? (
    <Link
      to="/"
      aria-label="Secured Landing home"
      className="inline-flex min-w-0 items-center"
    >
      {logo}
    </Link>
  ) : (
    logo
  );
}
