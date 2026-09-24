/** The training modules that may report a score, and how to label them. */
export const MODULES: Record<string, { title: string; icon: string }> = {
  'number-memory':     { title: 'Acoustic Memory',       icon: '🎧' },
  'cube':              { title: 'Spatial (CUBE)',        icon: '🧊' },
  'clock':             { title: 'Spatial (CLOCK)',       icon: '🕐' },
  'compass':           { title: 'Spatial (COMPASS)',     icon: '🧭' },
  'visual-perception': { title: 'Visual Perception',     icon: '👁️' },
  'password':          { title: 'Symbol Pattern',        icon: '🔑' },
  'focus':             { title: 'Focus',                 icon: '🎯' },
};

export const MODULE_SLUGS = Object.keys(MODULES);

export function moduleTitle(slug: string) {
  return MODULES[slug]?.title ?? slug;
}

export function moduleIcon(slug: string) {
  return MODULES[slug]?.icon ?? '•';
}
