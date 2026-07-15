import { Link } from "react-router-dom";

interface BrandLogoProps {
  className?: string;
  linkToHome?: boolean;
  light?: boolean;
}

export default function BrandLogo({
  className = "h-11 w-auto max-w-[240px]",
  linkToHome = true,
  light = false,
}: BrandLogoProps) {
  const logo = (
    <img
      src="/secured-landing-logo.svg"
      alt="Secured Landing"
      className={`${className} object-contain [image-rendering:auto] ${light ? "brightness-0 invert" : ""}`}
      decoding="async"
      draggable={false}
    />
  );

  return linkToHome ? (
    <Link to="/" aria-label="Secured Landing home" className="inline-flex min-w-0 items-center">
      {logo}
    </Link>
  ) : (
    logo
  );
}
