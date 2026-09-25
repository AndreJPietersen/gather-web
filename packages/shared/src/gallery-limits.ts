// A soft product/cost-control cap, not a security invariant (unlike, say,
// the installment-sum check), so a plain count-then-check in each gallery's
// upload action is proportionate — no DB trigger needed for a limit that
// only exists to keep Storage volume/egress predictable, not to protect
// data integrity. Lives outside any "use server" actions file because a
// Server Actions module may only export async functions — a plain
// constant export there breaks the whole module (Next.js 16 build error:
// "The module has no exports at all").
export const MAX_GALLERY_IMAGES = 20;
