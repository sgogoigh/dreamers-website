"use client";

import { useParams } from "next/navigation";

import { StudioExperience } from "@/components/studio/StudioExperience";

export default function DreamThreadPage() {
  const params = useParams<{ dreamId: string }>();
  return (
    <StudioExperience
      key={params.dreamId}
      initialDreamId={params.dreamId}
    />
  );
}
