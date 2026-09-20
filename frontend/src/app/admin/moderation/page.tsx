import { listModerationQueue } from "@/mocks/db";
import {
  AdminPageHeader,
  RequireCapability,
} from "@/components/admin/admin-shell";
import { ModerationConsole } from "@/components/admin/moderation-console";

export const dynamic = "force-dynamic";

export const metadata = { title: "Moderation" };

export default function ModerationPage() {
  const queue = listModerationQueue("pending");

  return (
    <RequireCapability capability="moderation.review">
      <AdminPageHeader
        title="Moderation console"
        description="Submitted photo, reference gallery, GPS against the geofence and every automated signal, side by side. Keyboard-first — A approve, R reject, → next, U undo."
      />
      <ModerationConsole initial={queue} />
    </RequireCapability>
  );
}
