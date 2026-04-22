import { useEffect, useState } from "react";
import { listenNumbers } from "../services/numbersService";
import type { WaNumber } from "../models/waNumber.model";

export function useWaNumbers() {
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenNumbers((nums) => {
      setNumbers(nums);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { numbers, loading };
}
