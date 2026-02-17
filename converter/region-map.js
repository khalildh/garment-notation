// Panel name → GNL body region mapping
// Based on the 23 Korosteleva NeurIPS 2021 garment templates

/**
 * Map a Korosteleva panel name to a GNL body region string.
 * Uses panel name + garment type context for disambiguation.
 *
 * @param {string} panelName - e.g. 'front', 'Lback', 'lfsleeve'
 * @param {string} garmentType - e.g. 'tee', 'pants', 'skirt', 'dress', 'jumpsuit', 'jacket'
 * @returns {{ region: string, side?: 'L'|'R' }}
 */
export function mapPanelToRegion(panelName, garmentType) {
  const name = panelName.toLowerCase();

  // Sleeve panels
  if (name === 'lfsleeve' || name === 'lbsleeve') return { region: '%arm.L', side: 'L' };
  if (name === 'rfsleeve' || name === 'rbsleeve') return { region: '%arm.R', side: 'R' };
  if (name === 'sleeve' || name === 'sleeve_l') return { region: '%arm.L', side: 'L' };
  if (name === 'sleeve_r') return { region: '%arm.R', side: 'R' };

  // Pants panels
  if (name === 'lfront') return { region: '%leg.L', side: 'L' };
  if (name === 'rfront') return { region: '%leg.R', side: 'R' };
  if (name === 'lback') return { region: '%leg.L', side: 'L' };
  if (name === 'rback') return { region: '%leg.R', side: 'R' };

  // Dress / jumpsuit upper panels
  if (name === 'top_front' || name === 'up_front') return { region: '%torso.front' };
  if (name === 'top_back' || name === 'up_back') return { region: '%torso.back' };

  // Dress skirt panels (lower half of dress)
  if (name === 'skirt_front') return { region: '%torso.front + %leg[0..0.3]' };
  if (name === 'skirt_back') return { region: '%torso.back + %leg[0..0.3]' };

  // Jumpsuit lower panels
  if (name === 'low_front' || name === 'low_lfront') return { region: '%leg.L', side: 'L' };
  if (name === 'low_rfront') return { region: '%leg.R', side: 'R' };
  if (name === 'low_back' || name === 'low_lback') return { region: '%leg.L', side: 'L' };
  if (name === 'low_rback') return { region: '%leg.R', side: 'R' };

  // Skirt side panels (4-panel skirts)
  if (name === 'left') return { region: '%torso.L', side: 'L' };
  if (name === 'right') return { region: '%torso.R', side: 'R' };

  // Waistband
  if (name === 'wb' || name === 'waistband') return { region: '%waist' };

  // Hood
  if (name === 'hood_left' || name === 'hood_l') return { region: '%neck', side: 'L' };
  if (name === 'hood_right' || name === 'hood_r') return { region: '%neck', side: 'R' };

  // Cuffs / collar
  if (name === 'cuff' || name === 'cuff_l' || name === 'cuff_r') return { region: '%arm[0.9..1]' };
  if (name === 'collar') return { region: '%neck' };

  // Generic front/back — context-dependent
  if (name === 'front' || name === 'ftorso') {
    if (garmentType === 'pants') return { region: '%leg.L' };
    return { region: '%torso.front' };
  }
  if (name === 'back' || name === 'btorso') {
    if (garmentType === 'pants') return { region: '%leg.L' };
    return { region: '%torso.back' };
  }

  // Fallback
  return { region: '%torso.front' };
}

/**
 * Detect garment type from panel names.
 * @param {string[]} panelNames
 * @returns {string}
 */
export function detectGarmentType(panelNames) {
  const names = panelNames.map(n => n.toLowerCase());

  const hasSleeves = names.some(n => n.includes('sleeve'));
  const hasPantsLegs = names.some(n => /^[lr](front|back)$/.test(n));
  const hasDressSkirt = names.some(n => n.includes('skirt_'));
  const hasDressTop = names.some(n => n.includes('top_'));
  const hasJumpsuitUp = names.some(n => n.includes('up_'));
  const hasJumpsuitLow = names.some(n => n.includes('low_'));
  const hasFrontBack = names.includes('front') && names.includes('back');
  const hasSides = names.includes('left') || names.includes('right');

  if (hasJumpsuitUp || hasJumpsuitLow) return 'jumpsuit';
  if (hasDressTop && hasDressSkirt) return 'dress';
  if (hasDressSkirt) return 'dress';
  if (hasPantsLegs) return 'pants';
  if (hasSleeves && hasFrontBack) return 'tee';
  if (hasSleeves) return 'jacket';
  if (hasSides) return 'skirt';
  if (hasFrontBack && !hasSleeves) return 'skirt';

  return 'garment';
}
