# University logos for the landing hero

Drop each university's logo file here using the **exact filename** below. The
landing hero (`src/phases/Landing.jsx` → `FloatingSchools`) auto-loads them.

- Preferred format: **`.svg`** (scales crisply). `.png` also works — the loader
  tries `<slug>.svg` first, then `<slug>.png`.
- Logos sit on a **light/cream chip**, so dark or full-color marks both read well.
  Use versions with a transparent background.
- Until a file exists, that card shows a fallback seal automatically — so partial
  sets never look broken. Add files incrementally; each card upgrades on reload.

## Filenames expected

| File              | University         |
| ----------------- | ------------------ |
| `mit.svg`         | MIT                |
| `harvard.svg`     | Harvard            |
| `stanford.svg`    | Stanford           |
| `yale.svg`        | Yale               |
| `princeton.svg`   | Princeton          |
| `columbia.svg`    | Columbia           |
| `caltech.svg`     | Caltech            |
| `brown.svg`       | Brown              |
| `uchicago.svg`    | UChicago           |
| `cornell.svg`     | Cornell            |
| `upenn.svg`       | UPenn              |
| `berkeley.svg`    | UC Berkeley        |
| `nyuad.svg`       | NYU Abu Dhabi      |
| `cmu.svg`         | Carnegie Mellon    |

To add, remove, or reposition schools, edit the `SCHOOLS` array in
`src/phases/Landing.jsx` (each entry's `slug` is the filename without extension).

> Note: these are trademarked institutional logos. Use official asset versions
> and confirm your usage is permitted for this product.
