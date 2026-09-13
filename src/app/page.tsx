import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Phase 1 style-proof page — not the real guest Home (that's Phase 3). Just
// enough on screen to visually confirm fonts/colors/shapes/components are
// wired correctly end to end before building real screens on top of them.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Gather</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">
          Design system check — Phase 1, not the real Home screen yet.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <span className="text-xs font-extrabold tracking-wide text-primary">TYPE</span>
        <p className="font-display text-xl font-semibold">Fredoka display type</p>
        <p className="text-sm font-bold">Nunito body text, bold.</p>
        <p className="text-sm font-semibold text-text-muted">Nunito body text, muted.</p>
      </Card>

      <Card className="flex flex-col gap-3">
        <span className="text-xs font-extrabold tracking-wide text-primary">BUTTONS</span>
        <Button variant="primary">Plan an Event</Button>
        <Button variant="secondary">List Your Business</Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <span className="text-xs font-extrabold tracking-wide text-primary">INPUT</span>
        <Input placeholder="Search vendors" />
      </Card>

      <div className="flex gap-2">
        <span className="rounded-pill bg-secondary-soft px-3 py-1 text-xs font-extrabold text-ink">
          Secondary soft
        </span>
        <span className="rounded-pill bg-success-soft px-3 py-1 text-xs font-extrabold text-ink">
          Success soft
        </span>
        <span className="rounded-pill bg-primary-soft px-3 py-1 text-xs font-extrabold text-ink">
          Primary soft
        </span>
      </div>
    </main>
  );
}
