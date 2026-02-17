// Korosteleva NeurIPS 2021 dataset example templates
// Full JSON files live in converter/examples/ and are fetched at runtime
// Source: https://github.com/maria-korosteleva/Garment-Pattern-Generator

export const KOROSTELEVA_TEMPLATES = {
  k_tee: {
    name: 'basic_tee',
    label: 'Basic Tee',
    path: '../../converter/examples/tee.json',
  },
  k_skirt: {
    name: 'skirt_2_panels',
    label: 'Skirt (2-panel)',
    path: '../../converter/examples/skirt_2_panels.json',
  },
  k_pants: {
    name: 'pants_straight_sides',
    label: 'Pants (straight)',
    path: '../../converter/examples/pants_straight.json',
  },
  k_dress: {
    name: 'dress',
    label: 'Dress (bodice + skirt)',
    path: '../../converter/examples/dress.json',
  },
};
