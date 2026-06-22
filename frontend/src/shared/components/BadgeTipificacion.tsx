import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { tipificacionColorMap } from "@/shared/constants/tipificacionColors";
import { cn } from "@/shared/lib/cn";

type Props = { value?: TipificacionDeuda; suffix?: string };

export function BadgeTipificacion({ value, suffix }: Props) {
  if (!value) {
    return (
      <span className="inline-flex rounded-full border px-2.5 py-0.5 text-xs text-gray-500">
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tipificacionColorMap[value]
      )}
    >
      {value}{suffix && <span className="ml-1 font-semibold">{suffix}</span>}
    </span>
  );
}
