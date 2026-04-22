import { useState } from "react";
import { useParams } from "react-router-dom";
import { IconMessage } from "@tabler/icons-react";
import { InboxPanel } from "./InboxPanel";
import { ConversationThread } from "./ConversationThread";
import { LeadPanel } from "./LeadPanel";

export default function WhatsAppLayout() {
  const { numberId, convId } = useParams<{ numberId: string; convId?: string }>();

  const [showInbox, setShowInbox] = useState(true);
  const [showDetails, setShowDetails] = useState(true);

  if (!numberId) return null;

  return (
    <div className="-m-4 md:-m-6 flex h-[calc(100vh-74px)] overflow-hidden border-t border-border">

      {/* Panel izquierdo — Inbox */}
      {showInbox && (
        <aside className="w-72 border-r border-border flex-shrink-0 flex flex-col overflow-hidden bg-background">
          <InboxPanel numberId={numberId} activeConvId={convId} />
        </aside>
      )}

      {/* Panel central — Hilo de mensajes */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        {convId ? (
          <ConversationThread
            numberId={numberId}
            convId={convId}
            showInbox={showInbox}
            showDetails={showDetails}
            onToggleInbox={() => setShowInbox((v) => !v)}
            onToggleDetails={() => setShowDetails((v) => !v)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <IconMessage className="w-10 h-10 opacity-20" />
            <p className="text-sm">Selecciona una conversación del panel izquierdo</p>
          </div>
        )}
      </main>

      {/* Panel derecho — Datos del contacto */}
      {showDetails && (
        <aside className="w-64 border-l border-border flex-shrink-0 bg-background hidden lg:flex flex-col overflow-hidden">
          <LeadPanel numberId={numberId} convId={convId} />
        </aside>
      )}
    </div>
  );
}
