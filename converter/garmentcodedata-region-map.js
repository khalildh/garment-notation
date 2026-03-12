// Panel name → GNL body region mapping for GarmentCodeData (ECCV 2024)
// GarmentCodeData panel names come from modular GarmentCode programs
// e.g. 'ftb_front', 'fts_skirtPanel_skirt_panel', 'wb_waistband'
// We split on '_' and match known tokens instead of a fixed lookup table.

import { mapPanelToRegion as mapKorostelevaPanel } from './region-map.js';

// Token → body region/role mapping
const REGION_TOKENS = {
  front:     'front',
  back:      'back',
  sleeve:    'sleeve',
  skirt:     'skirt',
  waist:     'waist',
  waistband: 'waist',
  wb:        'waist',
  collar:    'collar',
  hood:      'hood',
  cuff:      'cuff',
  pants:     'pants',
  pant:      'pants',
  leg:       'leg',
  bodice:    'bodice',
  yoke:      'yoke',
  pocket:    'pocket',
  placket:   'placket',
  band:      'band',
  panel:     null, // generic, ignored
  right:     null, // handled as side
  left:      null, // handled as side
};

// Token → side mapping
const SIDE_TOKENS = {
  left: 'L', l: 'L', lf: 'L', lb: 'L',
  right: 'R', r: 'R', rf: 'R', rb: 'R',
};

// Token → front/back mapping
const FB_TOKENS = {
  front: 'front', f: 'front', frt: 'front', ftb: 'front', fts: 'front',
  ftorso: 'front',
  back: 'back', b: 'back', bk: 'back',
  btorso: 'back',
};

/**
 * Map a GarmentCodeData panel name to a GNL body region.
 * Uses token-based matching on underscore-separated names.
 *
 * @param {string} panelName - e.g. 'ftb_front', 'fts_skirtPanel_skirt_panel'
 * @param {string} garmentType
 * @returns {{ region: string, side?: 'L'|'R' }}
 */
export function mapGCDPanelToRegion(panelName, garmentType) {
  const tokens = panelName.toLowerCase().split('_');

  // Detect side
  let side = undefined;
  for (const t of tokens) {
    if (SIDE_TOKENS[t]) { side = SIDE_TOKENS[t]; break; }
  }

  // Detect front/back
  let fb = undefined;
  for (const t of tokens) {
    if (FB_TOKENS[t]) { fb = FB_TOKENS[t]; break; }
  }

  // Detect primary role
  let role = null;
  for (const t of tokens) {
    if (REGION_TOKENS[t] !== undefined && REGION_TOKENS[t] !== null) {
      role = REGION_TOKENS[t];
      break;
    }
  }

  // Sleeve
  if (role === 'sleeve' || tokens.some(t => t.includes('sleeve'))) {
    const armSide = side || (fb === 'front' ? 'L' : 'L');
    return { region: `%arm.${armSide}`, side: armSide };
  }

  // Cuff
  if (role === 'cuff' || tokens.some(t => t.includes('cuff'))) {
    return { region: '%arm[0.9..1]' };
  }

  // Hood
  if (role === 'hood' || tokens.some(t => t.includes('hood'))) {
    return { region: '%neck', side };
  }

  // Collar
  if (role === 'collar' || tokens.some(t => t.includes('collar'))) {
    return { region: '%neck' };
  }

  // Waist / waistband
  if (role === 'waist' || tokens.some(t => t.includes('waist'))) {
    return { region: '%waist' };
  }

  // Pants / leg
  if (role === 'pants' || role === 'leg') {
    const legSide = side || 'L';
    return { region: `%leg.${legSide}`, side: legSide };
  }

  // Skirt
  if (role === 'skirt') {
    if (fb === 'front') return { region: '%torso.front + %leg[0..0.3]' };
    if (fb === 'back') return { region: '%torso.back + %leg[0..0.3]' };
    return { region: '%torso.front + %leg[0..0.3]' };
  }

  // Bodice / yoke
  if (role === 'bodice' || role === 'yoke') {
    if (fb === 'back') return { region: '%torso.back' };
    return { region: '%torso.front' };
  }

  // Front/back torso (default for body panels)
  if (fb === 'front') {
    if (garmentType === 'pants') return { region: '%leg.L', side: 'L' };
    return { region: '%torso.front' };
  }
  if (fb === 'back') {
    if (garmentType === 'pants') return { region: '%leg.L', side: 'L' };
    return { region: '%torso.back' };
  }

  // Try the existing Korosteleva mapper as fallback
  return mapKorostelevaPanel(panelName, garmentType);
}

/**
 * Detect garment type from GarmentCodeData panel names.
 * Uses token matching to handle modular GarmentCode naming.
 *
 * @param {string[]} panelNames
 * @returns {string}
 */
export function detectGCDGarmentType(panelNames) {
  const all = panelNames.join('_').toLowerCase();
  const tokens = new Set(panelNames.flatMap(n => n.toLowerCase().split('_')));

  const hasSleeve = tokens.has('sleeve') || all.includes('sleeve');
  const hasPants = tokens.has('pants') || tokens.has('pant') || tokens.has('leg') || all.includes('pant');
  const hasSkirt = tokens.has('skirt') || all.includes('skirt');
  const hasHood = tokens.has('hood') || all.includes('hood');
  const hasBodice = all.includes('bodice') || all.includes('torso');
  const hasFrontBack = (tokens.has('front') || tokens.has('f')) &&
                       (tokens.has('back') || tokens.has('b'));

  // Jumpsuit: has both upper body and pants/legs
  if (hasBodice && hasPants) return 'jumpsuit';
  if (hasSleeve && hasPants) return 'jumpsuit';

  // Dress: bodice + skirt
  if (hasSkirt && (hasBodice || hasSleeve)) return 'dress';
  if (hasSkirt && hasFrontBack) return 'dress';

  // Pants
  if (hasPants) return 'pants';

  // Skirt (no bodice)
  if (hasSkirt) return 'skirt';

  // Tee / jacket
  if (hasSleeve) {
    if (hasHood) return 'jacket';
    return 'tee';
  }

  if (hasFrontBack) return 'skirt';

  return 'garment';
}
