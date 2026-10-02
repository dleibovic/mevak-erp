# Project implementation rules

- Keep global light/dark visual roles in `src/index.css` and map them through Tailwind's semantic colors, so every screen inherits brand changes without modifying data logic.
- Use `next-themes` at the app root with a class on `<html>` for appearance preference, so the existing toast theme and all routes stay in sync.