import { createContext, useContext, useEffect, useState } from "react";
import { listenNumbers } from "@/modules/whatsapp/services/numbersService";
import type { WaNumber } from "@/modules/whatsapp/models/waNumber.model";
import { useAuth } from "@/app/providers/AuthContext";

interface WaNumbersState {
  numbers: WaNumber[];
  loading: boolean;
  error: string | null;
}

const WaNumbersContext = createContext<WaNumbersState>({ numbers: [], loading: true, error: null });

export function WaNumbersProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<WaNumbersState>({ numbers: [], loading: true, error: null });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ numbers: [], loading: false, error: null });
      return;
    }
    return listenNumbers(
      (nums) => setState({ numbers: nums, loading: false, error: null }),
      (err) => setState({ numbers: [], loading: false, error: err.message })
    );
  }, [user, authLoading]);

  return <WaNumbersContext.Provider value={state}>{children}</WaNumbersContext.Provider>;
}

export const useWaNumbersContext = () => useContext(WaNumbersContext);
