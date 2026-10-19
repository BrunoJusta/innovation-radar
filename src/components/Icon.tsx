import { ICONS } from "@/lib/icon-paths";

export const CATEGORY_ICONS = ["wine", "sparkle", "leaf", "cube", "chart-line", "globe", "flask", "users", "lightbulb", "target", "kanban", "gear", "rss", "check-circle", "tray", "device-mobile", "briefcase", "scales"];

export function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  const body = ICONS[name] || "";
  return (
    <svg className={`i ${className}`} width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: body }} />
  );
}
