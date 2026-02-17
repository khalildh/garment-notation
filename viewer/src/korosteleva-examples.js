// Trimmed Korosteleva NeurIPS 2021 dataset templates (pattern + properties only)
// Full templates: https://github.com/maria-korosteleva/Garment-Pattern-Generator

export const KOROSTELEVA_TEMPLATES = {
  k_tee: {
    name: 'basic_tee',
    label: 'Basic Tee',
    json: {
      pattern: {
        panels: {
          lfsleeve: {
            vertices: [[-10,25],[15,25],[25,-25],[-10,-25]],
            edges: [{endpoints:[0,3]},{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.7,-0.4]},{endpoints:[1,0]}]
          },
          back: {
            vertices: [[-25,58.75],[-55,58.75],[-65,8.75],[-65,-126.25],[65,-126.25],[65,8.75],[55,58.75],[25,58.75]],
            edges: [
              {endpoints:[0,7],curvature:[0.5,-0.3]},{endpoints:[7,6]},{endpoints:[6,5],curvature:[0.7,-0.4]},
              {endpoints:[5,4]},{endpoints:[4,3]},{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.3,-0.4]},{endpoints:[1,0]}
            ]
          },
          lbsleeve: {
            vertices: [[-10,25],[25,25],[15,-25],[-10,-25]],
            edges: [{endpoints:[0,3]},{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.3,-0.4]},{endpoints:[1,0]}]
          },
          rfsleeve: {
            vertices: [[-10,25],[25,25],[15,-25],[-10,-25]],
            edges: [{endpoints:[0,3]},{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.3,-0.4]},{endpoints:[1,0]}]
          },
          rbsleeve: {
            vertices: [[-10,25],[15,25],[25,-25],[-10,-25]],
            edges: [{endpoints:[0,3]},{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.7,-0.4]},{endpoints:[1,0]}]
          },
          front: {
            vertices: [[0,21.11],[-25,56.11],[-55,56.11],[-65,6.11],[-65,-128.89],[65,-128.89],[65,6.11],[55,56.11],[25,56.11]],
            edges: [
              {endpoints:[0,1]},{endpoints:[1,2]},{endpoints:[2,3],curvature:[0.7,0.4]},{endpoints:[3,4]},
              {endpoints:[4,5]},{endpoints:[5,6]},{endpoints:[6,7],curvature:[0.3,0.4]},{endpoints:[7,8]},{endpoints:[8,0]}
            ]
          }
        },
        stitches: [
          [{edge:7,panel:"back"},{edge:1,panel:"front"}],
          [{edge:5,panel:"back"},{edge:3,panel:"front"}],
          [{edge:3,panel:"back"},{edge:5,panel:"front"}],
          [{edge:1,panel:"back"},{edge:7,panel:"front"}],
          [{edge:2,panel:"rfsleeve"},{edge:2,panel:"front"}],
          [{edge:2,panel:"rbsleeve"},{edge:6,panel:"back"}],
          [{edge:2,panel:"lfsleeve"},{edge:6,panel:"front"}],
          [{edge:2,panel:"lbsleeve"},{edge:2,panel:"back"}],
          [{edge:1,panel:"lbsleeve"},{edge:3,panel:"lfsleeve"}],
          [{edge:3,panel:"lbsleeve"},{edge:1,panel:"lfsleeve"}],
          [{edge:3,panel:"rbsleeve"},{edge:1,panel:"rfsleeve"}],
          [{edge:1,panel:"rbsleeve"},{edge:3,panel:"rfsleeve"}]
        ]
      },
      properties: {units_in_meter: 300}
    }
  },

  k_skirt: {
    name: 'skirt_2_panels',
    label: 'Skirt (2-panel)',
    json: {
      pattern: {
        panels: {
          front: {
            vertices: [[-20.1,30],[20.1,30],[25.4,15],[33.3,-30],[-33.3,-30],[-25.4,15]],
            edges: [
              {endpoints:[4,3],curvature:[0.5,-0.1]},{endpoints:[3,2]},{endpoints:[2,1]},
              {endpoints:[1,0],curvature:[0.5,0.1]},{endpoints:[0,5]},{endpoints:[5,4]}
            ]
          },
          back: {
            vertices: [[20.1,30],[-20.1,30],[-25.4,15],[-33.3,-30],[33.3,-30],[25.4,15]],
            edges: [
              {endpoints:[3,4],curvature:[0.5,-0.1]},{endpoints:[4,5]},{endpoints:[5,0]},
              {endpoints:[0,1],curvature:[0.5,0.1]},{endpoints:[1,2]},{endpoints:[2,3]}
            ]
          }
        },
        stitches: [
          [{edge:2,panel:"back"},{edge:4,panel:"front"}],
          [{edge:1,panel:"back"},{edge:5,panel:"front"}],
          [{edge:5,panel:"back"},{edge:1,panel:"front"}],
          [{edge:4,panel:"back"},{edge:2,panel:"front"}]
        ]
      },
      properties: {units_in_meter: 100}
    }
  },

  k_pants: {
    name: 'pants_straight_sides',
    label: 'Pants (straight)',
    json: {
      pattern: {
        panels: {
          Lback: {
            vertices: [[25,0],[0,0],[0,-60],[35,-60],[35,-30]],
            edges: [
              {endpoints:[0,1]},{endpoints:[1,2],curvature:[0.1,-0.1]},{endpoints:[2,3]},
              {endpoints:[3,4],curvature:[0.95,0.1]},{endpoints:[4,0],curvature:[0.25,0.4]}
            ]
          },
          Rback: {
            vertices: [[-25,0],[0,0],[0,-60],[-35,-60],[-35,-30]],
            edges: [
              {endpoints:[4,3],curvature:[0.05,0.1]},{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.9,-0.1]},
              {endpoints:[1,0]},{endpoints:[0,4],curvature:[0.75,0.4]}
            ]
          },
          Rfront: {
            vertices: [[15,0],[0,0],[0,-60],[25,-60],[25,-30]],
            edges: [
              {endpoints:[0,1]},{endpoints:[1,2],curvature:[0.1,-0.1]},{endpoints:[2,3]},
              {endpoints:[3,4],curvature:[0.95,0.1]},{endpoints:[4,0],curvature:[0.25,0.35]}
            ]
          },
          Lfront: {
            vertices: [[-15,0],[0,0],[0,-60],[-25,-60],[-25,-30]],
            edges: [
              {endpoints:[4,3],curvature:[0.05,0.1]},{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.9,-0.1]},
              {endpoints:[1,0]},{endpoints:[0,4],curvature:[0.75,0.35]}
            ]
          }
        },
        stitches: [
          [{edge:1,panel:"Rfront"},{edge:2,panel:"Rback"}],
          [{edge:3,panel:"Rfront"},{edge:0,panel:"Rback"}],
          [{edge:2,panel:"Lfront"},{edge:1,panel:"Lback"}],
          [{edge:0,panel:"Lfront"},{edge:3,panel:"Lback"}],
          [{edge:4,panel:"Rback"},{edge:4,panel:"Lback"}],
          [{edge:4,panel:"Rfront"},{edge:4,panel:"Lfront"}]
        ]
      },
      properties: {units_in_meter: 100}
    }
  },

  k_dress: {
    name: 'dress',
    label: 'Dress (bodice + skirt)',
    json: {
      pattern: {
        panels: {
          top_back: {
            vertices: [[8.33,19.58],[18.33,19.58],[21.67,2.92],[17,-17.08],[-17,-17.08],[-21.67,2.92],[-18.33,19.58],[-8.33,19.58]],
            edges: [
              {endpoints:[4,3]},{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.3,0.4]},{endpoints:[1,0]},
              {endpoints:[0,7],curvature:[0.5,0.3]},{endpoints:[7,6]},{endpoints:[6,5],curvature:[0.7,0.4]},{endpoints:[5,4]}
            ]
          },
          top_front: {
            vertices: [[0,7.04],[-8.33,18.70],[-18.33,18.70],[-21.67,2.04],[-17,-17.96],[17,-17.96],[21.67,2.04],[18.33,18.70],[8.33,18.70]],
            edges: [
              {endpoints:[4,5]},{endpoints:[5,6]},{endpoints:[6,7],curvature:[0.3,0.4]},{endpoints:[7,8]},
              {endpoints:[8,0]},{endpoints:[0,1]},{endpoints:[1,2]},{endpoints:[2,3],curvature:[0.7,0.4]},{endpoints:[3,4]}
            ]
          },
          skirt_front: {
            vertices: [[-17,25],[17,25],[22.58,10],[33.33,-30],[-33.33,-30],[-22.58,10]],
            edges: [
              {endpoints:[4,3],curvature:[0.5,-0.1]},{endpoints:[3,2]},{endpoints:[2,1]},{endpoints:[1,0]},
              {endpoints:[0,5]},{endpoints:[5,4]}
            ]
          },
          skirt_back: {
            vertices: [[17,25],[-17,25],[-22.58,10],[-33.33,-30],[33.33,-30],[22.58,10]],
            edges: [
              {endpoints:[3,4],curvature:[0.5,-0.1]},{endpoints:[4,5]},{endpoints:[5,0]},{endpoints:[0,1]},
              {endpoints:[1,2]},{endpoints:[2,3]}
            ]
          },
          lfsleeve: {
            vertices: [[-3.33,8.33],[5,8.33],[8.33,-8.33],[-3.33,-8.33]],
            edges: [{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.7,-0.4]},{endpoints:[1,0]},{endpoints:[0,3]}]
          },
          lbsleeve: {
            vertices: [[-3.33,8.33],[8.33,8.33],[5,-8.33],[-3.33,-8.33]],
            edges: [{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.3,-0.4]},{endpoints:[1,0]},{endpoints:[0,3]}]
          },
          rbsleeve: {
            vertices: [[-3.33,8.33],[5,8.33],[8.33,-8.33],[-3.33,-8.33]],
            edges: [{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.7,-0.4]},{endpoints:[1,0]},{endpoints:[0,3]}]
          },
          rfsleeve: {
            vertices: [[-3.33,8.33],[8.33,8.33],[5,-8.33],[-3.33,-8.33]],
            edges: [{endpoints:[3,2]},{endpoints:[2,1],curvature:[0.3,-0.4]},{endpoints:[1,0]},{endpoints:[0,3]}]
          }
        },
        stitches: [
          [{edge:7,panel:"top_back"},{edge:1,panel:"top_front"}],
          [{edge:5,panel:"top_back"},{edge:3,panel:"top_front"}],
          [{edge:3,panel:"top_back"},{edge:6,panel:"top_front"}],
          [{edge:1,panel:"top_back"},{edge:8,panel:"top_front"}],
          [{edge:2,panel:"skirt_back"},{edge:4,panel:"skirt_front"}],
          [{edge:1,panel:"skirt_back"},{edge:5,panel:"skirt_front"}],
          [{edge:5,panel:"skirt_back"},{edge:1,panel:"skirt_front"}],
          [{edge:4,panel:"skirt_back"},{edge:2,panel:"skirt_front"}],
          [{edge:3,panel:"skirt_front"},{edge:0,panel:"top_front"}],
          [{edge:0,panel:"top_back"},{edge:3,panel:"skirt_back"}],
          [{edge:1,panel:"rfsleeve"},{edge:7,panel:"top_front"}],
          [{edge:1,panel:"rbsleeve"},{edge:2,panel:"top_back"}],
          [{edge:1,panel:"lfsleeve"},{edge:2,panel:"top_front"}],
          [{edge:1,panel:"lbsleeve"},{edge:6,panel:"top_back"}],
          [{edge:0,panel:"lbsleeve"},{edge:2,panel:"lfsleeve"}],
          [{edge:2,panel:"lbsleeve"},{edge:0,panel:"lfsleeve"}],
          [{edge:2,panel:"rbsleeve"},{edge:0,panel:"rfsleeve"}],
          [{edge:0,panel:"rbsleeve"},{edge:2,panel:"rfsleeve"}]
        ]
      },
      properties: {units_in_meter: 100}
    }
  }
};
