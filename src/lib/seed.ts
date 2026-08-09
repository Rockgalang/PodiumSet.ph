import bcrypt from "bcryptjs";
import { db } from "./db";
import type { PlanRow, AddonRow, RequestTypeRow } from "./types";

export async function seedIfEmpty() {
  
  const planCount = await db.prepare("SELECT COUNT(*) AS c FROM plan").get() as {
    c: number;
  };
  if (planCount.c === 0) {
    const insertPlan = await db.prepare(
      `INSERT INTO plan
        (name, price_php, active_slots, includes_video, consult_hours, shoot_hours,
         includes_ads, priority_queue, featured, tagline, description, sort_order)
       VALUES (@name, @price_php, @active_slots, @includes_video, @consult_hours,
         @shoot_hours, @includes_ads, @priority_queue, @featured, @tagline, @description, @sort_order)`
    );
    const plans: Array<Omit<PlanRow, "id">> = [
      {
        name: "Graphic Design",
        price_php: 7995,
        active_slots: 1,
        includes_video: 0,
        consult_hours: 0,
        shoot_hours: 0,
        includes_ads: 0,
        priority_queue: 0,
        featured: 0,
        tagline: "Unlimited design requests, one at a time.",
        description:
          "Everything visual your brand needs â€” social posts, logos, flyers, packaging, ad creatives â€” delivered one at a time, as fast as possible.",
        sort_order: 1,
      },
      {
        name: "Multimedia",
        price_php: 12995,
        active_slots: 1,
        includes_video: 1,
        consult_hours: 1,
        shoot_hours: 0,
        includes_ads: 0,
        priority_queue: 0,
        featured: 1,
        tagline: "Best and Top Choice â€” design and video.",
        description:
          "Graphic design plus short-form video editing, with 1 hour of monthly design consultancy. The most popular package for growing brands.",
        sort_order: 2,
      },
      {
        name: "Marketing",
        price_php: 19995,
        active_slots: 2,
        includes_video: 1,
        consult_hours: 4,
        shoot_hours: 1,
        includes_ads: 1,
        priority_queue: 0,
        featured: 0,
        tagline: "Design, video and ad management in one.",
        description:
          "Two concurrent requests, short-form video, 4 monthly consultancy hours, 1 free shoot hour per month, and ad campaign management included.",
        sort_order: 3,
      },
      {
        name: "Corporate",
        price_php: 29995,
        active_slots: 2,
        includes_video: 1,
        consult_hours: 4,
        shoot_hours: 2,
        includes_ads: 1,
        priority_queue: 1,
        featured: 0,
        tagline: "Everything in Marketing, with priority queue.",
        description:
          "Two concurrent requests, priority placement in our queue, 4 monthly consultancy hours, 2 free shoot hours, and ad management included.",
        sort_order: 4,
      },
      {
        name: "Advertising Management",
        price_php: 4995,
        active_slots: 0,
        includes_video: 0,
        consult_hours: 0,
        shoot_hours: 0,
        includes_ads: 1,
        priority_queue: 0,
        featured: 0,
        tagline: "Standalone ad management, no design queue.",
        description:
          "We run your Meta advertising for you. No request queue â€” monthly performance reporting and campaign notes instead.",
        sort_order: 5,
      },
    ];
    await db.transaction(async () => {
      for (const p of plans) await insertPlan.run(p);
    });
  }

  const addonCount = await db.prepare("SELECT COUNT(*) AS c FROM addon").get() as {
    c: number;
  };
  if (addonCount.c === 0) {
    const insertAddon = await db.prepare(
      `INSERT INTO addon (name, price_php, bundled_price_php, requires_plan, allowed_plans, description)
       VALUES (@name, @price_php, @bundled_price_php, @requires_plan, @allowed_plans, @description)`
    );
    const addons: Array<Omit<AddonRow, "id">> = [
      {
        name: "Advertising Management",
        price_php: 4995,
        bundled_price_php: 2995,
        requires_plan: 1,
        allowed_plans: JSON.stringify([1, 2]),
        description:
          "We manage your Meta ads. â‚±2,995/mo when bundled with a design package, â‚±4,995 standalone. Ad spend is client-funded.",
      },
      {
        name: "AI Creative",
        price_php: 2499,
        bundled_price_php: 2499,
        requires_plan: 1,
        allowed_plans: JSON.stringify([]),
        description:
          "Unlocks AI generation as a source option on design and video requests. Uses your existing request slot â€” no extra concurrency.",
      },
    ];
    await db.transaction(async () => {
      for (const a of addons) await insertAddon.run(a);
    });
  }

  const rtCount = await db.prepare("SELECT COUNT(*) AS c FROM request_type").get() as {
    c: number;
  };
  if (rtCount.c === 0) {
    const insertRt = await db.prepare(
      `INSERT INTO request_type (slug, name, slot_consuming, brief_schema, sla_hours, available_rules, sort_order)
       VALUES (@slug, @name, @slot_consuming, @brief_schema, @sla_hours, @available_rules, @sort_order)`
    );
    const types: Array<Omit<RequestTypeRow, "id">> = [
      {
        slug: "graphic_design",
        name: "Graphic design",
        slot_consuming: 1,
        sla_hours: 48,
        sort_order: 1,
        available_rules: JSON.stringify({}),
        brief_schema: JSON.stringify([
          {
            key: "deliverable",
            label: "What do you need?",
            type: "text",
            required: true,
            placeholder: "e.g. Facebook post, logo, flyer, packaging",
          },
          {
            key: "dimensions",
            label: "Dimensions / platform",
            type: "text",
            placeholder: "e.g. 1080x1080, Instagram Story, A5",
          },
          {
            key: "copy_text",
            label: "Copy text",
            type: "textarea",
            placeholder: "Paste the exact wording to use",
          },
          {
            key: "references",
            label: "Reference links (one per line)",
            type: "links",
            placeholder: "https://...",
          },
          {
            key: "deadline_preference",
            label: "Deadline preference",
            type: "text",
            placeholder: "Tell us if this is urgent",
          },
        ]),
      },
      {
        slug: "video_editing",
        name: "Video editing",
        slot_consuming: 1,
        sla_hours: 72,
        sort_order: 2,
        available_rules: JSON.stringify({ requires_video: true }),
        brief_schema: JSON.stringify([
          {
            key: "footage_link",
            label: "Raw footage link",
            type: "url",
            required: true,
            placeholder: "Google Drive / Dropbox / WeTransfer link",
          },
          {
            key: "target_length",
            label: "Target length",
            type: "text",
            placeholder: "e.g. 60 seconds",
          },
          {
            key: "platform",
            label: "Platform",
            type: "select",
            required: true,
            options: [
              "YouTube",
              "Instagram Reels",
              "TikTok",
              "Facebook",
              "Facebook / Instagram Ads",
              "Other",
            ],
          },
          {
            key: "captions",
            label: "Captions",
            type: "select",
            options: ["Yes â€” burned in", "Yes â€” SRT file", "No"],
          },
          {
            key: "music_preference",
            label: "Music preference",
            type: "text",
            placeholder: "Style, mood, or specific track references",
          },
          {
            key: "references",
            label: "Reference videos (links)",
            type: "links",
            placeholder: "https://...",
          },
        ]),
      },
      {
        slug: "consultancy_booking",
        name: "Consultancy booking",
        slot_consuming: 0,
        sla_hours: 24,
        sort_order: 5,
        available_rules: JSON.stringify({ requires_consult: true }),
        brief_schema: JSON.stringify([
          {
            key: "topic",
            label: "What do you want to discuss?",
            type: "text",
            required: true,
            placeholder: "e.g. brand direction, ad strategy, pricing a launch",
          },
          {
            key: "preferred_slots",
            label: "Preferred slots",
            type: "text",
            placeholder: "e.g. Mon 10am, Thu 3pm",
          },
          {
            key: "attendees",
            label: "Who will attend?",
            type: "text",
          },
        ]),
      },
      {
        slug: "shoot_booking",
        name: "Shoot booking",
        slot_consuming: 0,
        sla_hours: 48,
        sort_order: 6,
        available_rules: JSON.stringify({ requires_shoot: true }),
        brief_schema: JSON.stringify([
          {
            key: "location",
            label: "Location",
            type: "text",
            required: true,
          },
          {
            key: "date_options",
            label: "Date options",
            type: "text",
            required: true,
            placeholder: "e.g. Aug 12 or Aug 15, morning preferred",
          },
          {
            key: "deliverable",
            label: "What should the shoot produce?",
            type: "text",
            required: true,
          },
          {
            key: "hours_needed",
            label: "Hours needed",
            type: "number",
          },
        ]),
      },
      {
        slug: "ad_campaign_setup",
        name: "Ad campaign setup",
        slot_consuming: 0,
        sla_hours: 24,
        sort_order: 7,
        available_rules: JSON.stringify({ requires_ads: true }),
        brief_schema: JSON.stringify([
          {
            key: "objective",
            label: "Objective",
            type: "select",
            required: true,
            options: [
              "Brand awareness",
              "Traffic",
              "Engagement",
              "Leads",
              "Sales",
            ],
          },
          {
            key: "audience",
            label: "Target audience",
            type: "textarea",
            required: true,
            placeholder: "Location, age, interests, behavior",
          },
          {
            key: "budget",
            label: "Monthly ad budget",
            type: "text",
            required: true,
            placeholder: "Ad spend is client-funded",
          },
          {
            key: "landing_page",
            label: "Landing page / offer URL",
            type: "url",
          },
          {
            key: "offer",
            label: "What's the offer?",
            type: "text",
          },
        ]),
      },
    ];
    await db.transaction(async () => {
      for (const t of types) await insertRt.run(t);
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@podiumset.ph";
  const adminExists = await db
    .prepare("SELECT COUNT(*) AS c FROM user WHERE role = 'admin'")
    .get() as { c: number };
  if (adminExists.c === 0) {
    const password =
      process.env.ADMIN_PASSWORD ||
      (() => {
        throw new Error(
          "ADMIN_PASSWORD not set â€” add .env from .env.example before first run"
        );
      })();
    const hash = bcrypt.hashSync(password, 10);
    await db.transaction(async () => {
      const info = await db
        .prepare(
          "INSERT INTO account (business_name, contact_name, email, mobile) VALUES (?, ?, ?, ?)"
        )
        .run("PodiumSet", "Jasper", adminEmail, "");
      const accountId = Number(info.lastInsertRowid);
      await db.prepare(
        "INSERT INTO user (account_id, email, password_hash, role, email_verified) VALUES (?, ?, ?, 'admin', 1)"
      ).run(accountId, adminEmail, hash);
      await db.prepare(
        "INSERT INTO subscription (account_id, status) VALUES (?, 'active')"
      ).run(accountId);
    });
  }
}

async function migrateDropPrint() {
  
  const printRt = await db
    .prepare("SELECT id FROM request_type WHERE slug = 'print'")
    .get() as { id: number } | undefined;
  if (printRt) {
    await db.transaction(async () => {
      await db.prepare("DELETE FROM request WHERE request_type_id = ?").run(printRt.id);
      await db.prepare("DELETE FROM request_type WHERE slug = 'print'").run();
    });
    console.log("[seed] Removed print request type (printing no longer serviced).");
  }
  await db.exec(
    "ALTER TABLE subscription DROP COLUMN IF EXISTS print_credits_monthly"
  );
}

async function migrateDropAiCreative() {
  
  const aiRt = await db
    .prepare("SELECT id FROM request_type WHERE slug = 'ai_creative'")
    .get() as { id: number } | undefined;
  if (aiRt) {
    await db.transaction(async () => {
      await db.prepare("DELETE FROM request WHERE request_type_id = ?").run(aiRt.id);
      await db.prepare("DELETE FROM request_type WHERE slug = 'ai_creative'").run();
    });
    console.log(
      "[seed] Removed AI Creative request type (now a source option on design/video requests)."
    );
  }
}

export async function runMigrations() {
  await migrateDropPrint();
  await migrateDropAiCreative();
}

export async function seedOnBoot() {
  await runMigrations();
  await seedIfEmpty();
}