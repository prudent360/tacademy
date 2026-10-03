/** Stroke icons used across the site, portal and admin. */
type IconProps = { className?: string };

function Svg({ className = "size-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export type Icon = (p: IconProps) => React.JSX.Element;

export const HomeIcon: Icon = (p) => <Svg {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></Svg>;
export const BookIcon: Icon = (p) => <Svg {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M8 7h7" /></Svg>;
export const CalendarIcon: Icon = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></Svg>;
export const ClipboardIcon: Icon = (p) => <Svg {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M9 12h6" /><path d="M9 16h4" /></Svg>;
export const UsersIcon: Icon = (p) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></Svg>;
export const UserIcon: Icon = (p) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
export const CardIcon: Icon = (p) => <Svg {...p}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /><path d="M6.5 15h4" /></Svg>;
export const PhoneIcon: Icon = (p) => <Svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></Svg>;
export const MailIcon: Icon = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Svg>;
export const CogIcon: Icon = (p) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Svg>;
export const BellIcon: Icon = (p) => <Svg {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></Svg>;
export const LogoutIcon: Icon = (p) => <Svg {...p}><path d="M15 4h4v16h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></Svg>;
export const PlusIcon: Icon = (p) => <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>;
export const ExternalIcon: Icon = (p) => <Svg {...p}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>;
export const ArrowRight: Icon = (p) => <Svg {...p}><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></Svg>;
export const ArrowLeft: Icon = (p) => <Svg {...p}><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></Svg>;
export const CheckIcon: Icon = (p) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const VideoIcon: Icon = (p) => <Svg {...p}><rect x="2.5" y="6" width="13" height="12" rx="2" /><path d="M15.5 10.5l6-3.5v10l-6-3.5" /></Svg>;
export const PinIcon: Icon = (p) => <Svg {...p}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></Svg>;
export const ClockIcon: Icon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const DownloadIcon: Icon = (p) => <Svg {...p}><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></Svg>;
export const MenuIcon: Icon = (p) => <Svg {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Svg>;
export const ChevronDown: Icon = (p) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const ChevronRight: Icon = (p) => <Svg {...p}><path d="M9 18l6-6-6-6" /></Svg>;
export const FileIcon: Icon = (p) => <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></Svg>;
export const LinkIcon: Icon = (p) => <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>;
export const BriefcaseIcon: Icon = (p) => <Svg {...p}><rect x="2.5" y="7" width="19" height="13" rx="2" /><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" /><path d="M2.5 12.5h19" /></Svg>;
export const IdCardIcon: Icon = (p) => <Svg {...p}><rect x="2.5" y="4.5" width="19" height="15" rx="2" /><circle cx="8.5" cy="11" r="2.5" /><path d="M5 16.5a3.5 3.5 0 0 1 7 0" /><path d="M14.5 10h4" /><path d="M14.5 14h3" /></Svg>;
export const AwardIcon: Icon = (p) => <Svg {...p}><circle cx="12" cy="9" r="6" /><path d="M8.5 14.2L7 22l5-3 5 3-1.5-7.8" /></Svg>;
export const ChartIcon: Icon = (p) => <Svg {...p}><path d="M3 20h18" /><path d="M6 16l4-5 3 3 5-7" /></Svg>;
export const MegaphoneIcon: Icon = (p) => <Svg {...p}><path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z" /><path d="M17 8a5 5 0 0 1 0 8" /></Svg>;
export const LayersIcon: Icon = (p) => <Svg {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></Svg>;
export const KeyIcon: Icon = (p) => <Svg {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9" /><path d="M16 7l3 3" /></Svg>;
export const CapIcon: Icon = (p) => <Svg {...p}><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></Svg>;
export const ShieldIcon: Icon = (p) => <Svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></Svg>;
export const MonitorIcon: Icon = (p) => <Svg {...p}><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></Svg>;
export const BuildingIcon: Icon = (p) => <Svg {...p}><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" /><path d="M16 9h2a2 2 0 0 1 2 2v10" /><path d="M8 7h4" /><path d="M8 11h4" /><path d="M8 15h4" /><path d="M3 21h18" /></Svg>;
export const SwapIcon: Icon = (p) => <Svg {...p}><path d="M7 4L3 8l4 4" /><path d="M3 8h13" /><path d="M17 20l4-4-4-4" /><path d="M21 16H8" /></Svg>;
export const SparkIcon: Icon = (p) => <Svg {...p}><path d="M12 3v4" /><path d="M12 17v4" /><path d="M3 12h4" /><path d="M17 12h4" /><path d="M6 6l2.5 2.5" /><path d="M15.5 15.5L18 18" /><path d="M6 18l2.5-2.5" /><path d="M15.5 8.5L18 6" /></Svg>;
export const MessageIcon: Icon = (p) => <Svg {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8" /><path d="M8 12.5h5" /></Svg>;
export const GridIcon: Icon = (p) => <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>;
export const XIcon: Icon = (p) => <Svg {...p}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Svg>;
export const TrendIcon: Icon = (p) => <Svg {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></Svg>;
export const AlertIcon: Icon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5v.01" /></Svg>;
export const PlayIcon: Icon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" /></Svg>;
export const SearchIcon: Icon = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>;
export const CheckCircleIcon: Icon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Svg>;
export const XCircleIcon: Icon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6" /><path d="M15 9l-6 6" /></Svg>;
export const BankIcon: Icon = (p) => <Svg {...p}><path d="M3 10l9-6 9 6" /><path d="M5 10v8" /><path d="M9.5 10v8" /><path d="M14.5 10v8" /><path d="M19 10v8" /><path d="M3 20h18" /></Svg>;
export const SunIcon: Icon = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></Svg>;
export const MoonIcon: Icon = (p) => <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Svg>;
export const PaletteIcon: Icon = (p) => <Svg {...p}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15" cy="8" r="1" /></Svg>;
export const EyeIcon: Icon = (p) => <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const EyeOffIcon: Icon = (p) => <Svg {...p}><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5" /><path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></Svg>;
export const LockIcon: Icon = (p) => <Svg {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Svg>;
export const DatabaseIcon: Icon = (p) => <Svg {...p}><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></Svg>;
export const EditIcon: Icon = (p) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></Svg>;

export const CodeIcon: Icon = (p) => <Svg {...p}><path d="M8 7l-5 5 5 5" /><path d="M16 7l5 5-5 5" /><path d="M13.5 4.5l-3 15" /></Svg>;
