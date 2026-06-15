import {
  GitBranch,
  GraduationCap,
  Mail,
  MessageSquare,
  Play,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Timer,
  Users
} from "lucide-react";

const icons = {
  play: Play,
  mail: Mail,
  "message-square": MessageSquare,
  "graduation-cap": GraduationCap,
  users: Users,
  search: Search,
  timer: Timer,
  split: GitBranch,
  "shield-check": ShieldCheck,
  "shield-alert": ShieldAlert,
  "shield-x": ShieldX
};

export function NodeIcon({ icon, className = "h-4 w-4" }: { icon: string; className?: string }) {
  const Icon = icons[icon as keyof typeof icons] ?? GitBranch;
  return <Icon className={className} strokeWidth={2.2} />;
}
