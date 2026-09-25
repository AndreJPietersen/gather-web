# Bundled fonts

Fredoka, Nunito and Dancing Script (SIL Open Font License 1.1, from Google Fonts), **latin subset only**, committed here so the production build never has to download fonts (`next/font/google` fetched them from Google at build time and failed on GitHub's runners). Loaded in `../layout.tsx` with `next/font/local`.

To add characters outside Latin (for example Polish or Vietnamese names), download the `latin-ext` files from the Google Fonts CSS and add them as extra `src` entries.
