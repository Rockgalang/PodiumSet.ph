export interface AiSourceConfig {
  field: string;
  promptKey: string;
  promptLabel: string;
  promptPlaceholder: string;
  segmentLabel: string;
  linkLabel: string;
  aiLabel: string;
}

export const AI_SOURCE: Record<string, AiSourceConfig> = {
  graphic_design: {
    field: "references",
    promptKey: "ai_design_prompt",
    promptLabel: "AI design prompt",
    promptPlaceholder:
      "Describe the design you want AI to generate — subject, style, mood, colors, layout…",
    segmentLabel: "How should we produce this?",
    linkLabel: "Human designer + references",
    aiLabel: "AI-generated (AI Gen add-on)",
  },
  video_editing: {
    field: "footage_link",
    promptKey: "ai_footage_prompt",
    promptLabel: "AI footage prompt",
    promptPlaceholder:
      "Describe the footage you want AI to generate — shots, subject, mood, style, length…",
    segmentLabel: "Raw footage",
    linkLabel: "Footage link",
    aiLabel: "Generate footage with AI (AI Gen add-on)",
  },
};

export function aiSourceFor(
  typeSlug: string | null | undefined
): AiSourceConfig | null {
  if (!typeSlug) return null;
  return AI_SOURCE[typeSlug] ?? null;
}
