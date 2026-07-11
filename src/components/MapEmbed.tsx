interface MapEmbedProps {
  address?: string | null;
  apn?: string | null;
  county?: string | null;
  state?: string | null;
  height?: number;
}

/**
 * Embeds a Google Maps iframe centered on the property.
 * Falls back to an APN/county/state search query when no street address exists.
 */
export default function MapEmbed({
  address,
  apn,
  county,
  state,
  height = 300,
}: MapEmbedProps) {
  const query = address
    ? address
    : [apn && `APN ${apn}`, county, state].filter(Boolean).join(", ");

  if (!query) return null;

  const encoded = encodeURIComponent(query);
  const src = `https://www.google.com/maps/embed/v1/search?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY ?? ""}&q=${encoded}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-emerald-600">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <span className="text-xs font-semibold text-slate-700">Property Location</span>
        </div>
        <a
          href={`https://www.google.com/maps/search/${encoded}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-emerald-600 hover:underline"
        >
          Open in Maps ↗
        </a>
      </div>
      {import.meta.env.VITE_GOOGLE_MAPS_KEY ? (
        <iframe
          title="Property location map"
          src={src}
          width="100%"
          height={height}
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        /* Graceful fallback when no API key is set */
        <div
          className="flex flex-col items-center justify-center gap-3 bg-slate-100 text-slate-500"
          style={{ height }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <p className="max-w-xs text-center text-sm font-medium">{query}</p>
          <a
            href={`https://www.google.com/maps/search/${encoded}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            View on Google Maps
          </a>
          <p className="text-xs text-slate-400">Add VITE_GOOGLE_MAPS_KEY to enable embedded map</p>
        </div>
      )}
    </div>
  );
}
