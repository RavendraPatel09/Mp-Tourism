"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { Destination } from "@/lib/types";
import { DestinationEditor } from "./destination-editor";

export function DestinationEditorClient({
  destination,
  completenessScore,
}: {
  destination: Destination;
  completenessScore: number;
}) {
  const router = useRouter();

  return (
    <DestinationEditor
      destination={destination}
      completenessScore={completenessScore}
      onSave={async (patch) => {
        await api.admin.updateDestination(destination.slug, patch);
        router.refresh();
      }}
    />
  );
}
