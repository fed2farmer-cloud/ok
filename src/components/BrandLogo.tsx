import { Link } from "react-router-dom";

type BrandLogoProps = {
  className?: string;
  linkToHome?: boolean;
  light?: boolean;
};

export default function BrandLogo({
  className = "h-14 w-auto max-w-[250px]",
  linkToHome = true,
}: BrandLogoProps) {
  const logo = (
    <img
      src="/securedlanding-brand.svg"
      alt="SecuredLanding — Land-Backed Lending"
      className={`${className} block object-contain`}
      width="920"
      height="220"
      decoding="async"
      loading="eager"
      draggable={false}
    />
  );

  return linkToHome ? (
    <Link to="/" aria-label="SecuredLanding home" className="inline-flex min-w-0 items-center">
      {logo}
    </Link>
  ) : (
    logo
  );
}
