import {validateCover,type CoverSettings} from '../../../../../covers/catalog';
export const TEMPLATES = ['minimal', 'professional', 'showcase'] as const;
export type Template = typeof TEMPLATES[number];
export type Presentation = {
  version: 1;
  template: Template;
  title: string;
  subtitle: string;
  cover?: CoverSettings;
  brand: {name: string; tagline: string; primary: string; accent: string; logo?: string};
  intro: {enabled: boolean; durationMs: number; sound?: string; soundPreset:'none'|'soft'|'bright'; volume: number};
  outro: {enabled: boolean; durationMs: number; title: string; subtitle: string; url: string};
  body: {logoPosition: 'left' | 'right' | 'none'; highlightColor: string};
};

export function presentationPreset(template: Template, title: string, subtitle = ''): Presentation {
  if (!TEMPLATES.includes(template)) throw Error(`Unknown presentation template: ${template}`);
  return {
    version: 1, template, title, subtitle,
    brand: {name: 'Demo', tagline: 'A closer look.', primary: '#153F3B', accent: '#A7F3CE'},
    intro: {enabled: true, durationMs: template === 'minimal' ? 1400 : 3000, soundPreset:template==='minimal'?'none':template==='professional'?'soft':'bright', volume: 0.35},
    outro: {enabled: true, durationMs: template === 'minimal' ? 1400 : 2400, title: 'Thanks for watching.', subtitle: 'Explore the workflow at your own pace.', url: ''},
    body: {logoPosition: template === 'minimal' ? 'none' : 'right', highlightColor: '#E3A900'},
  };
}

export function validatePresentation(value: unknown, localAssets = true): asserts value is Presentation {
  const p = value as Presentation;
  const text = (s: unknown, max: number, required = false) => typeof s === 'string' && s.length <= max && (!required || !!s.trim());
  const color = (s: unknown) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
  if (p?.version !== 1 || !TEMPLATES.includes(p.template)) throw Error('Presentation version/template is invalid');
  if (p.cover !== undefined) validateCover(p.cover);
  if (!text(p.title, 100, true) || !text(p.subtitle, 160) || !text(p.brand?.name, 40, !p.cover) || !text(p.brand?.tagline, 100)) throw Error('Presentation title/brand text is invalid or too long');
  if (!color(p.brand.primary) || !color(p.brand.accent) || !color(p.body?.highlightColor)) throw Error('Presentation colors must be six-digit hex colors');
  if (!['left', 'right', 'none'].includes(p.body.logoPosition)) throw Error('Body logoPosition must be left, right or none');
  for (const card of [p.intro, p.outro]) {
    if (typeof card?.enabled !== 'boolean' || !Number.isFinite(card.durationMs) || card.durationMs < 500 || card.durationMs > 15000) throw Error('Card durationMs must be between 500 and 15000');
  }
  if (!Number.isFinite(p.intro.volume) || p.intro.volume < 0 || p.intro.volume > 1) throw Error('Intro volume must be between 0 and 1');
  if (!['none','soft','bright'].includes(p.intro.soundPreset)) throw Error('Unknown intro soundPreset');
  if (!text(p.outro.title, 100, true) || !text(p.outro.subtitle, 160) || !text(p.outro.url, 120)) throw Error('Outro text is invalid or too long');
  for (const asset of [p.brand.logo, p.intro.sound]) {
    if (asset !== undefined && (!text(asset, 1024, true) || (localAssets && (/^(\/|[a-z]+:)/i.test(asset) || asset.split(/[\\/]/).includes('..') || asset.includes('\\'))))) throw Error('Presentation assets must be local files, never URLs or traversal paths');
  }
  if (p.brand.logo && !/\.(png|jpe?g|webp)$/i.test(p.brand.logo)) throw Error('Logo must be a PNG, JPEG or WebP image');
  if (p.intro.sound && !/\.(wav|mp3|m4a)$/i.test(p.intro.sound)) throw Error('Intro sound must be WAV, MP3 or M4A');
  if (!p.intro.enabled && p.intro.sound) throw Error('A disabled intro cannot have a sound');
}
