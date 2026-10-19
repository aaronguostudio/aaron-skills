// A brand's opening and closing card: the mark, the name, the line under it, and the sting that
// plays once as the mark settles. Pure data and timing, so the render CLI can check a profile
// before it spends a render on it.
//
// The mark is drawn from `parts` rather than loaded as a file, so each piece can be animated on
// its own. Give it the primitives straight out of the brand's SVG.

// Primitives a mark may use. Each part keeps its own SVG attributes (`points`, `d`, `cx`…), which
// are passed through untouched, so a mark is a copy of the real asset rather than a redrawing.
export const PART_KINDS = ["rect", "path", "polygon", "ellipse", "circle"] as const;
export type PartKind = (typeof PART_KINDS)[number];
// Where a mark's own geometry sits. A brand overrides it when its asset uses another box.
export const DEFAULT_VIEW_BOX = "-50 -50 320 320";
export const MAX_PARTS = 64;

export type BrandPart = {
  kind: PartKind;
  // The piece's own colour. Without one it inherits the card's text colour, so a single-colour
  // mark needs no fills at all.
  fill?: string;
} & Record<string, string | number | undefined>;

export type Brand = {
  name: string;
  slogan: string;
  // The card's background. The name and the line on it are always white, so this is a dark colour.
  primary: string;
  viewBox?: string;
  parts: BrandPart[];
  // Plays once over the opening card. Capture-local, like every other asset the composition
  // reads, because the capture folder is the render's public dir.
  sound?: string;
  // Opt-in opening notice. Omitted or false keeps the delivered film clean.
  aiNotice?: boolean;
};

const local = (path: string) => !path.includes("..") && !/^(\/|[a-z]+:)/i.test(path);

export function validateBrand(value: unknown): asserts value is Brand {
  const brand = value as Brand;
  if (!brand?.name?.trim() || brand.name.length > 36) throw new Error("A brand needs a name of at most 36 characters");
  if (!brand.slogan?.trim() || brand.slogan.length > 72) throw new Error("A brand needs a line of at most 72 characters");
  if (brand.aiNotice !== undefined && typeof brand.aiNotice !== 'boolean') throw new Error('aiNotice must be boolean');
  if (!brand.primary) throw new Error("A brand needs a card colour");
  if (brand.sound && !local(brand.sound)) throw new Error("A brand's sound must be a capture-local asset");
  if (!Array.isArray(brand.parts) || brand.parts.length < 1 || brand.parts.length > MAX_PARTS) {
    throw new Error(`A brand mark needs between 1 and ${MAX_PARTS} parts`);
  }
  for (const part of brand.parts) {
    if (!PART_KINDS.includes(part?.kind)) throw new Error(`A brand mark cannot be drawn with "${part?.kind}"`);
    if (part.kind === "path" && !part.d) throw new Error("A path part needs its d");
    if (part.kind === "polygon" && !part.points) throw new Error("A polygon part needs its points");
  }
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

// The mark assembles: every piece starts a little off its place and settles in, each one a beat
// after the last. The golden angle spreads their directions so no two arrive from the same side.
export function brandPieceState(frame: number, index: number) {
  const p = clamp((frame - 3 - index * 0.32) / 24);
  const eased = 1 - Math.pow(1 - p, 3);
  if (p >= 1) return { x: 0, y: 0, opacity: 1 };
  const angle = index * 2.399963;
  const distance = 18 + (index % 4) * 7;
  return {
    x: Math.cos(angle) * distance * (1 - eased),
    y: Math.sin(angle) * distance * (1 - eased),
    opacity: 0.12 + 0.88 * eased,
  };
}

// The opening card fades out into the walkthrough; the closing card holds and is cut.
export function brandCardOpacity(frame: number, total: number) {
  return clamp((total - 1 - frame) / 8);
}
