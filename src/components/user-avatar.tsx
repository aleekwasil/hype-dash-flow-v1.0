/**
 * UserAvatar — single default avatar used across the app.
 * Gender-neutral, fintech-styled SVG illustration. No generated initials.
 *
 * If `src` is provided (e.g. profile.avatar_url) it is rendered instead.
 */
type Props = {
  src?: string | null;
  size?: number;
  className?: string;
  alt?: string;
};

export function UserAvatar({ src, size = 44, className = "", alt = "Profile" }: Props) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full object-cover ring-2 ring-background ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-background ${className}`}
      style={{ width: size, height: size }}
    >
      <DefaultAvatarSvg size={size} />
    </span>
  );
}

function DefaultAvatarSvg({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Default profile avatar"
    >
      <defs>
        <linearGradient id="ua-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.62 0.24 295)" />
          <stop offset="100%" stopColor="oklch(0.55 0.22 250)" />
        </linearGradient>
        <linearGradient id="ua-fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill="url(#ua-bg)" />
      {/* head */}
      <circle cx="32" cy="25" r="10" fill="url(#ua-fg)" />
      {/* shoulders */}
      <path
        d="M12 56c2-10 10-16 20-16s18 6 20 16v6H12v-6z"
        fill="url(#ua-fg)"
      />
    </svg>
  );
}
