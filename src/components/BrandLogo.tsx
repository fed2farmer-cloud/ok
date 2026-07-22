import React from "react";

interface BrandLogoProps {
  className?: string;
  dark?: boolean;
}

export default function BrandLogo({
  className = "",
  dark = false,
}: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/securedlanding-logo.png"
        alt="SecuredLanding"
        className="h-12 w-12 object-contain"
      />

      <div className="leading-tight">
        <h1
          className={`text-xl font-bold ${
            dark ? "text-slate-900" : "text-white"
          }`}
        >
          SecuredLanding
        </h1>

        <p
          className={`text-[10px] uppercase tracking-[0.25em] ${
            dark ? "text-slate-500" : "text-slate-300"
          }`}
        >
          LAND-BACKED LENDING
        </p>
      </div>
    </div>
  );
}