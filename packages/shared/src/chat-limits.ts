// Same soft product/cost-control cap as gallery-limits.ts, same reason it
// has to live outside any "use server" actions file (a Server Actions
// module may only export async functions). Chat threads see more
// concurrent-upload pressure than a slow planning gallery, but 20 was
// Andre's own call, matching MAX_GALLERY_IMAGES rather than a lower number.
export const MAX_CHAT_IMAGES = 20;
