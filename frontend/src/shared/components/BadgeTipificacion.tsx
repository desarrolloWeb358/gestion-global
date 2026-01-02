import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { tipificacionColorMap } from "@/shared/constants/tipificacionColors";
import { cn } from "@/shared/lib/cn";

type Props = { value?: TipificacionDeuda };

export function BadgeTipificacion({ value }: Props) {
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
      {value}
    </span>
  );
}
