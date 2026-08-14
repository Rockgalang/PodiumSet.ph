import Link from "next/link";
import { getPlans, getAddons } from "@/lib/queries";
import { peso } from "@/lib/format";
import { FaqAccordion } from "@/components/FaqAccordion";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { redirectIfAuthed } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const plans = await getPlans();
  const addons = await getAddons();
  const packages = plans.filter((p) => p.active_slots > 0);
  const standalone = plans.find((p) => p.active_slots === 0);
  const adAddon = addons.find((a) => a.name === "Advertising Management");
  const aiAddon = addons.find((a) => a.name === "AI Creative");

  await redirectIfAuthed();

  return (
    <div className="min-h-screen">
      {/* ===== Nav ===== */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#packages" className="nav-link transition-colors hover:text-paper">Pricing</a>
            <a href="#how" className="nav-link transition-colors hover:text-paper">How it works</a>
            <a href="#compare" className="nav-link transition-colors hover:text-paper">Why us</a>
            <a href="#faq" className="nav-link transition-colors hover:text-paper">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="nav-link text-sm text-muted transition-colors hover:text-paper">
              Login
            </Link>
            <Link
              href="/signup"
              className="btn-sheen rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-gold-strong active:scale-[0.98]"
            >
              Start your subscription
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_at_70%_-10%,rgba(224,180,77,0.12),transparent)]" />
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-24 text-center md:pt-32">
          <p className="rise mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 animate-float rounded-full bg-emerald-400" />
            Pause or cancel anytime · Made for Filipino businesses
          </p>
          <h1
            className="rise mx-auto max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Unlimited designs,
            <br />
            unlimited{" "}
            <span className="text-gold">opportunities.</span>
          </h1>
          <p
            className="rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg"
            style={{ animationDelay: "160ms" }}
          >
            One fixed monthly subscription. Unlimited requests, delivered one at
            a time, as fast as possible. Design, video, ad management and
            consultancy — all in one place.
          </p>
          <div
            className="rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/signup"
              className="btn-sheen w-full rounded-xl bg-gold px-8 py-3.5 text-base font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-gold-strong active:scale-[0.98] sm:w-auto"
            >
              Start your subscription
            </Link>
            <a
              href="#packages"
              className="w-full rounded-xl border border-line2 px-8 py-3.5 text-base font-medium text-paper transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/60 active:scale-[0.98] sm:w-auto"
            >
              See pricing
            </a>
          </div>
          <p
            className="rise mt-6 text-xs text-muted"
            style={{ animationDelay: "300ms" }}
          >
            From {peso(7995)}/month · No in-house designer required
          </p>
        </div>
      </section>

      {/* ===== Problem ===== */}
      <section className="border-t border-line bg-ink2">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold">
                Sound familiar?
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Doing your marketing yourself is costing more than the
                subscription would.
              </h2>
              <p className="mt-4 text-muted">
                You&apos;ve been running the whole show. Every post, every
                flyer, every video, every ad — on top of running your business.
                It&apos;s exhausting, it&apos;s inconsistent, and it&apos;s
                expensive.
              </p>
            </Reveal>
            <ul className="space-y-4">
              {[
                "No in-house designer — everything creative waits on you",
                "No consistent social content, so your brand looks amateur next to competitors",
                "No ad strategy — you boost posts and hope, but nothing converts",
                "No video crew, so you skip the format your customers actually watch",
                "Doing it all yourself means your business never gets your full attention",
              ].map((pain, i) => (
                <li key={i}>
                  <Reveal
                    delay={i * 60}
                    className="group flex items-start gap-3 rounded-xl border border-line bg-surface p-4 transition-all duration-300 hover:-translate-x-0.5 hover:border-line2 hover:bg-surface2"
                  >
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-bold text-gold transition-colors duration-300 group-hover:bg-gold group-hover:text-ink">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-paper2">
                      {pain}
                    </span>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===== Cost comparison ===== */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            The math
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Hiring the pieces costs {peso(35000)}–{peso(60000)} a month.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            One subscription replaces all of it — and you get a queue, a plan,
            and someone accountable for delivery.
          </p>
        </div>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <th className="py-3 pr-4">What you&apos;d hire</th>
                <th className="py-3 pr-4">Typical monthly cost</th>
                <th className="py-3">With PodiumSet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ["Freelance graphic designer", "₱15,000–₱25,000", "Included"],
                ["Short-form video editor", "₱8,000–₱15,000", "Included (Multimedia+)"],
                ["Social media / ad manager", "₱10,000–₱20,000", "Included (Marketing+)"],
                ["Design consultancy retainer", "₱5,000+", "Included"],
                ["On-site shoot crew", "₱8,000+ per shoot", "Free shoot hours"],
              ].map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-surface/60">
                  <td className="py-3.5 pr-4 font-medium text-paper">{row[0]}</td>
                  <td className="py-3.5 pr-4 text-muted">{row[1]}</td>
                  <td className="py-3.5">
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                      {row[2]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== Packages ===== */}
      <section id="packages" className="border-y border-line bg-ink2">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              One subscription, endless possibilities.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted">
              Unlimited requests. Fixed monthly price. Pause or cancel anytime.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {packages.map((p, i) => (
              <Reveal
                key={p.id}
                delay={i * 70}
                className={p.featured ? "lg:-mt-3 lg:mb-3" : ""}
              >
<div
                  className={`group relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1.5 ${
                    p.featured
                      ? "border-gold bg-surface shadow-[0_0_40px_-12px_rgba(224,180,77,0.35)] hover:shadow-[0_0_55px_-10px_rgba(224,180,77,0.5)]"
                      : "border-line bg-surface hover:border-line2 hover:shadow-[0_12px_40px_-20px_rgba(0,0,0,0.8)]"
                  }`}
                >
                  {p.featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink">
                      Best and Top Choice
                    </span>
                  )}
                  <h3 className="text-lg font-bold transition-colors group-hover:text-gold">{p.name}</h3>
                <p className="mt-1 text-xs text-muted">{p.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{peso(p.price_php)}</span>
                  <span className="text-sm text-muted">/month</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-paper2">
                  <li className="flex gap-2">
                    <Check /> Unlimited requests · {p.active_slots}{" "}
                    {p.active_slots === 1 ? "request" : "requests"} at a time
                  </li>
                  {p.includes_video ? (
                    <li className="flex gap-2"><Check /> Short-form video editing</li>
                  ) : (
                    <li className="flex gap-2 text-muted"><Dash /> No video editing</li>
                  )}
                  {p.consult_hours > 0 ? (
                    <li className="flex gap-2"><Check /> {p.consult_hours} hr{ p.consult_hours > 1 ? "s" : ""} consultancy/mo</li>
                  ) : (
                    <li className="flex gap-2 text-muted"><Dash /> No consultancy</li>
                  )}
                  {p.shoot_hours > 0 ? (
                    <li className="flex gap-2"><Check /> {p.shoot_hours} free shoot hr{ p.shoot_hours > 1 ? "s" : ""}/mo</li>
                  ) : (
                    <li className="flex gap-2 text-muted"><Dash /> No shoot hours</li>
                  )}
                  {p.includes_ads ? (
                    <li className="flex gap-2"><Check /> Ad campaign management</li>
                  ) : (
                    <li className="flex gap-2 text-muted"><Dash /> Ad management add-on</li>
                  )}
                  {p.priority_queue ? (
                    <li className="flex gap-2"><Check /> Priority queue placement</li>
                  ) : (
                    <li className="flex gap-2 text-muted"><Dash /> Standard queue</li>
                  )}
                  <li className="flex gap-2"><Check /> Pause or cancel anytime</li>
                </ul>
                <Link
                  href="/signup"
                  className={`mt-6 rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                    p.featured
                      ? "btn-sheen bg-gold text-ink hover:bg-gold-strong"
                      : "border border-line2 text-paper hover:border-gold/60"
                  }`}
                >
                  Start with {p.name}
                </Link>
              </div>
              </Reveal>
            ))}
          </div>

          {/* Standalone ad management */}
          {standalone && (
            <Reveal
              delay={packages.length * 70}
              className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-dashed border-line2 bg-surface p-6 transition-colors hover:border-gold/40 md:flex-row"
            >
              <div>
                <h3 className="text-lg font-bold">{standalone.name}</h3>
                <p className="mt-1 text-sm text-muted">{standalone.description}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">{peso(standalone.price_php)}/mo</span>
                <Link
                  href="/signup"
                  className="rounded-xl border border-line2 px-5 py-2.5 text-sm font-semibold hover:border-gold/60"
                >
                  Get ad management
                </Link>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ===== Add-ons ===== */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            Add-ons
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Layer on what you need.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {adAddon && (
            <Reveal className="rounded-2xl border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line2">
              <h3 className="text-lg font-bold">{adAddon.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{adAddon.description}</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{peso(adAddon.bundled_price_php)}</span>
                <span className="text-sm text-muted line-through">{peso(adAddon.price_php)}</span>
                <span className="text-xs text-gold">bundle discount</span>
              </div>
              <p className="mt-3 text-xs text-muted">
                Ad creatives and ad spend are not included — you fund the ad
                budget. Ads pause when your subscription is inactive.
              </p>
            </Reveal>
          )}
          {aiAddon && (
            <Reveal delay={100} className="rounded-2xl border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line2">
              <h3 className="text-lg font-bold">{aiAddon.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{aiAddon.description}</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{peso(aiAddon.price_php)}</span>
                <span className="text-sm text-muted">/month</span>
              </div>
              <p className="mt-3 text-xs text-muted">
                Consumes your existing request slot — it adds capability, not
                extra concurrency.
              </p>
            </Reveal>
          )}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" className="border-y border-line bg-ink2">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Live in under an hour.
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Sign up", "Two minutes, no TIN, no billing address."],
              ["Finalize package", "Pick a plan, add on what you need."],
              ["Upload payment", "GCash, BDO, or GoTyme. We verify it manually — usually within business hours."],
              ["Submit requests", "Pile up as many as you like. We work through them one at a time."],
              ["Receive work", "Approve, request revisions, or let it auto-approve in 3 business days."],
            ].map(([title, desc], i) => (
              <Reveal
                key={i}
                delay={i * 70}
                className="group rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-line2"
              >
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gold-soft text-sm font-bold text-gold transition-all duration-300 group-hover:scale-110 group-hover:bg-gold group-hover:text-ink">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Comparison ===== */}
      <section id="compare" className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            Why PodiumSet
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            International subscriptions, but built for the Philippines.
          </h2>
        </div>
        <Reveal className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <th className="py-3 pr-4 font-medium"> </th>
                <th className="py-3 pr-4 font-semibold text-gold">PodiumSet.ph</th>
                <th className="py-3 font-medium">International subscriptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ["Pricing", "From ₱7,995/mo, in pesos", "$1,000+/mo"],
                ["Support", "Taglish, fast replies", "Email + timezones"],
                ["Payment", "GCash, BDO, GoTyme — verified manually", "Foreign cards only"],
                ["Video editing", "Included on Multimedia+", "Design-only, no video"],
                ["Shoots", "Free monthly shoot hours on Marketing+", "Digital only"],
                ["Consultancy", "Monthly hours with a real strategist", "Rarely included"],
              ].map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-surface/60">
                  <td className="py-3.5 pr-4 font-medium text-paper">{row[0]}</td>
                  <td className="py-3.5 pr-4 text-paper2">{row[1]}</td>
                  <td className="py-3.5 text-muted">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="border-t border-line bg-ink2">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <Reveal className="mt-10">
            <FaqAccordion
              items={[
                {
                  q: "How fast will I receive my work?",
                  a: "Turnaround is measured from when a request enters Ongoing, not from submission. Most design requests deliver within 2 business days; video within 3. A long queue never makes a card late, because we measure the promise from when we actually start.",
                },
                {
                  q: "Is there a limit to how many requests I can make?",
                  a: "No. Add as many requests to your Project Lineup as you like. We work through them one at a time (or two, depending on your plan) in order.",
                },
                {
                  q: "How do revisions work?",
                  a: "Unlimited. Request changes on any For Approval card and it goes straight back into the active slot with your notes attached. If a card reaches several revisions, we'll suggest tightening the brief — that's our problem to fix, not a limit on you.",
                },
                {
                  q: "How does pausing work?",
                  a: "Pause anytime. Your remaining subscription days are frozen while paused — they don't expire. Resume when you have work again. One month, pause for a while, then come back: that pattern is exactly why we built it this way.",
                },
                {
                  q: "Can I use it for just one month?",
                  a: "For sure. Subscribe for a month, pause or cancel when done, and come back when you need more. No wasted remainder.",
                },
                {
                  q: "How do I pay?",
                  a: "GCash, BDO, or GoTyme. Upload your proof of payment and we verify it manually — usually within a few hours during business hours. There's no auto-charge; you pay when you want to continue.",
                },
                {
                  q: "What happens if my subscription runs out mid-request?",
                  a: "We finish whatever's in progress before locking the board. After your days hit zero you get a 14-day window to download all completed deliverables, then the board locks. Your files are never deleted.",
                },
                {
                  q: "How does the auto-approve rule work?",
                  a: "A For Approval card occupies an active slot until you respond. To stop your own queue from blocking itself, any card with no response for 3 business days auto-approves, with reminder emails on days 1 and 2. Approve or request changes before then and nothing is automatic.",
                },
                {
                  q: "What's not included?",
                  a: "3D rendering, web development, complex animation, InDesign book/magazine layout, and medical or legal form design are out of scope. Ad creatives and ad spend are not part of Advertising Management — you fund the ad budget.",
                },
                {
                  q: "Is there a mobilization fee for shoots?",
                  a: "Yes, a mobilization fee applies to all shoots. Your free shoot hours cover the crew time; the fee covers travel and setup.",
                },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ===== Footer CTA ===== */}
      <section className="mx-auto max-w-4xl px-5 py-24 text-center">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Your brand deserves a team behind it.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            One subscription. Unlimited work. Pause or cancel anytime.
          </p>
          <Link
            href="/signup"
            className="btn-sheen mt-8 inline-block rounded-xl bg-gold px-10 py-4 text-base font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-gold-strong active:scale-[0.98]"
          >
            Start your subscription
          </Link>
          <p className="mt-4 text-xs text-muted">
            From {peso(7995)}/month · First payment verified within business hours
          </p>
        </Reveal>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted md:flex-row">
          <Logo />
          <p className="text-xs">
            PodiumSet.ph · Unlimited Designs, Unlimited Opportunities
          </p>
          <div className="flex gap-4 text-xs">
            <a href="#packages" className="hover:text-paper">Pricing</a>
            <a href="#faq" className="hover:text-paper">FAQ</a>
            <Link href="/login" className="hover:text-paper">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Check() {
  return (
    <span className="mt-0.5 text-emerald-400">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Dash() {
  return (
    <span className="mt-1.5 h-px w-3 bg-muted" />
  );
}
