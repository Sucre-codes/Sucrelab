import DoctorAvatar from "./assets/Doctor.png";
import EconomistAvatar from "./assets/economist.png";
import EngineerAvatar from "./assets/engineer.png";
import LawyerAvatar from "./assets/lawyer.png";
import InvestorAvatar from "./assets/investor.png";
import OptimistAvatar from "./assets/optimist.png";
import PragmaticAvatar from "./assets/pragmatic.png";
import SkepticAvatar from "./assets/skeptic.png";
import TeacherAvatar from "./assets/teacher.png";
import PMAvatar from "./assets/pm.png";

const AVATAR_MAP: Record<string, string> = {
  optimist: OptimistAvatar,
  economist: EconomistAvatar,
  engineer: EngineerAvatar,
  lawyer: LawyerAvatar,
  investor: InvestorAvatar,
  teacher: TeacherAvatar,
  pm: PMAvatar,
  skeptic: SkepticAvatar,
  doctor: DoctorAvatar,
  pragmatist: PragmaticAvatar,
};

const COLOR_MAP: Record<string, string> = {
  teal: "var(--color-teal)",
  amber: "var(--color-amber)",
  muted: "var(--color-muted)",
   paper: "var(--color-paper)",
};

export function personaColor(color: string): string {
  return COLOR_MAP[color] || COLOR_MAP.muted;
}

export default function PersonaAvatar({
  label,
  color,
  size = 36,
}: {
  label: string;
  color: string;
  size?: number;
}) {
  const key = label.trim().toLowerCase();
  const avatar = AVATAR_MAP[key] 

  return (
    <img
      src={avatar}
      alt={label}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0 border-2"
      style={{
        borderColor: personaColor(color),
      }}
    />
  );
}
