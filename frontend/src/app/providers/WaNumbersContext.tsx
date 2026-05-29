import { createContext, useContext, useEffect, useState } from "react";
import { listenNumbers } from "@/modules/whatsapp/services/numbersService";
import type { WaNumber } from "@/modules/whatsapp/models/waNumber.model";

interface WaNumbersState {
  numbers: WaNumber[];
  loading: boolean;
}

const WaNumbersContext = createContext<WaNumbersState>({ numbers: [], loading: true });

export function WaNumbersProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WaNumbersState>({ numbers: [], loading: true });

  useEffect(() => {
    return listenNumbers((nums) => setState({ numbers: nums, loading: false }));
  }, []);

  return <WaNumbersContext.Provider value={state}>{children}</WaNumbersContext.Provider>;
}

export const useWaNumbersContext = () => useContext(WaNumbersContext);
