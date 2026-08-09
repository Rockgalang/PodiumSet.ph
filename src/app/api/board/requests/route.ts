import { err, ok, apiRequireClient } from "@/lib/route-auth";
import {
  getRequestType,
  getSubscriptionBundle,
  requestTypeAvailableOn,
  createRequest,
} from "@/lib/queries";
import { saveFile } from "@/lib/upload";
import { accessFor } from "@/lib/state";
import { aiSourceFor } from "@/lib/ai-source";

export async function POST(req: Request) {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  if (!s.subscription) return err("No subscription found", 404);
  const access = accessFor(s.subscription);
  if (access.level !== "full")
    return err("Your subscription is not active. Renew to submit requests.");

  const fd = await req.formData().catch(() => null);
  if (!fd) return err("Invalid form");

  const requestTypeId = Number(fd.get("request_type_id"));
  const title = String(fd.get("title") ?? "").trim();
  const rt = await getRequestType(requestTypeId);
  if (!rt) return err("Unknown request type.");
  if (!title) return err("Give your request a title.");

  const bundle = await getSubscriptionBundle(s.account_id);
  const availability = await requestTypeAvailableOn(
    rt,
    bundle?.plan ?? null,
    bundle?.addons ?? []
  );
  if (!availability.available)
    return err(availability.reason ?? "Not available on your plan.");

  const useAiSource = String(fd.get("use_ai_source") ?? "");
  const hasAiAddon = (bundle?.addons ?? []).some(
    (a) => a.name.toLowerCase().replace(/[^a-z0-9]/g, "") === "aicreative"
  );
  const aiConfig = aiSourceFor(rt.slug);
  const allowAiSource = !!aiConfig && hasAiAddon && useAiSource === rt.slug;

  const answers: Record<string, unknown> = {};
  const attachmentUrls: string[] = [];

  for (const field of rt.brief_schema) {
    if (field.type === "file") {
      const files = fd.getAll(field.key);
      const urls: string[] = [];
      for (const f of files) {
        if (!(f instanceof File) || f.size === 0) continue;
        try {
          const saved = await saveFile(f, "briefs", {
            maxBytes: 25 * 1024 * 1024,
          });
          urls.push(saved.url);
          attachmentUrls.push(saved.url);
        } catch (e) {
          return err((e as Error).message);
        }
      }
      answers[field.key] = urls;
      if (field.required && urls.length === 0)
        return err(`${field.label} is required.`);
    } else {
      if (aiConfig && field.key === aiConfig.field && allowAiSource) {
        answers[field.key] = "";
        continue;
      }
      const v = String(fd.get(field.key) ?? "").trim();
      answers[field.key] = field.type === "number" ? (v ? Number(v) : null) : v;
      if (field.required && !v) return err(`${field.label} is required.`);
    }
  }

  if (useAiSource) {
    if (!aiConfig || !allowAiSource)
      return err("AI generation requires the AI Creative add-on.");
    const prompt = String(fd.get(aiConfig.promptKey) ?? "").trim();
    if (!prompt) return err(`${aiConfig.promptLabel} is required.`);
    answers[aiConfig.promptKey] = prompt;
    answers.use_ai_source = useAiSource;
  }

  const id = await createRequest(s.account_id, s.user_id, {
    request_type_id: requestTypeId,
    title,
    brief_answers: answers,
    attachmentUrls,
  });
  return ok({ ok: true, id });
}
