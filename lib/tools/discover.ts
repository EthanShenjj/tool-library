import "server-only";

import { cache } from "react";
import generatedCandidates from "./generated.json";
import { type DiscoveredTool, toolManifestSchema } from "./schema";

type Candidate = {
  directory: string;
  manifest: unknown | null;
  package: { name?: string; description?: string } | null;
};

export const discoverTools = cache((): DiscoveredTool[] => {
  return (generatedCandidates as Candidate[])
    .map((candidate) => {
      const parsed = toolManifestSchema.safeParse(candidate.manifest);
      if (parsed.success) {
        return { ...parsed.data, directory: candidate.directory, configured: true } satisfies DiscoveredTool;
      }
      return {
        id: candidate.directory.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        name: candidate.package?.name || candidate.directory,
        description: candidate.package?.description || "此目录尚未提供有效的工具 Manifest。",
        category: "待接入",
        icon: "box",
        status: "maintenance" as const,
        entry: { type: "internal" as const, href: "#" },
        directory: candidate.directory,
        configured: false,
      };
    })
    .sort((a, b) => Number(b.configured) - Number(a.configured) || a.name.localeCompare(b.name, "zh-CN"));
});
