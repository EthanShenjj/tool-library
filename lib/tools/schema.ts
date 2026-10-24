import { z } from "zod";

export const toolManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(180),
  category: z.string().min(1).max(40),
  icon: z.string().min(1).max(40),
  status: z.enum(["ready", "beta", "maintenance"]),
  entry: z.discriminatedUnion("type", [
    z.object({ type: z.literal("internal"), href: z.string().startsWith("/") }),
    z.object({ type: z.literal("external"), url: z.string().url() }),
  ]),
});

export type ToolManifest = z.infer<typeof toolManifestSchema>;

export type DiscoveredTool = ToolManifest & {
  directory: string;
  configured: boolean;
};
