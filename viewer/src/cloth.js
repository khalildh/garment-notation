// @ts-check
/**
 * Verlet cloth simulation engine.
 * Pure math — no Three.js dependency.
 */

/**
 * @typedef {{
 *   cols: number,
 *   rows: number,
 *   positions: Float32Array,
 *   prevPositions: Float32Array,
 *   pinned: Uint8Array,
 *   constraints: { i: number, j: number, restLength: number }[]
 * }} Cloth
 */

/**
 * Create a particle grid for cloth simulation.
 * Particles laid out in row-major order, each with 3 floats (x, y, z).
 * @param {number} cols
 * @param {number} rows
 * @param {number} spacingX - horizontal spacing in world units
 * @param {number} spacingY - vertical spacing in world units
 * @returns {Cloth}
 */
export function createCloth(cols, rows, spacingX, spacingY) {
  const count = cols * rows;
  const positions = new Float32Array(count * 3);
  const prevPositions = new Float32Array(count * 3);
  const pinned = new Uint8Array(count);

  // Initialize flat grid in XY plane
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) * 3;
      positions[idx] = (c - (cols - 1) / 2) * spacingX;
      positions[idx + 1] = -r * spacingY; // Y down
      positions[idx + 2] = 0;
    }
  }
  prevPositions.set(positions);

  // Build constraints
  const constraints = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;

      // Structural — horizontal
      if (c < cols - 1) {
        constraints.push({ i, j: i + 1, restLength: spacingX });
      }
      // Structural — vertical
      if (r < rows - 1) {
        constraints.push({ i, j: i + cols, restLength: spacingY });
      }
      // Shear — diagonals
      if (c < cols - 1 && r < rows - 1) {
        const diag = Math.sqrt(spacingX * spacingX + spacingY * spacingY);
        constraints.push({ i, j: i + cols + 1, restLength: diag });
      }
      if (c > 0 && r < rows - 1) {
        const diag = Math.sqrt(spacingX * spacingX + spacingY * spacingY);
        constraints.push({ i, j: i + cols - 1, restLength: diag });
      }
      // Bend — skip-one horizontal
      if (c < cols - 2) {
        constraints.push({ i, j: i + 2, restLength: spacingX * 2 });
      }
      // Bend — skip-one vertical
      if (r < rows - 2) {
        constraints.push({ i, j: i + cols * 2, restLength: spacingY * 2 });
      }
    }
  }

  return { cols, rows, positions, prevPositions, pinned, constraints };
}

/**
 * Pin a particle so it stays fixed in place.
 * @param {Cloth} cloth
 * @param {number} index - particle index
 */
export function pinParticle(cloth, index) {
  cloth.pinned[index] = 1;
}

/**
 * Apply gravity acceleration to all unpinned particles.
 * Modifies positions in-place by adding 0.5 * g * dt^2 to Y.
 * @param {Cloth} cloth
 * @param {number} g - gravity magnitude (positive = downward)
 * @param {number} dt - timestep
 */
export function applyGravity(cloth, g, dt) {
  const count = cloth.cols * cloth.rows;
  const dt2 = dt * dt;
  for (let i = 0; i < count; i++) {
    if (cloth.pinned[i]) continue;
    cloth.positions[i * 3 + 1] -= g * dt2;
  }
}

/**
 * Run one simulation step: Verlet integration + constraint relaxation.
 * @param {Cloth} cloth
 * @param {number} dt - timestep
 * @param {number} iterations - constraint solver iterations (15-20 recommended)
 * @param {number} [damping=0.99] - velocity damping factor
 */
export function simulate(cloth, dt, iterations, damping = 0.99) {
  const count = cloth.cols * cloth.rows;
  const pos = cloth.positions;
  const prev = cloth.prevPositions;

  // Verlet integration
  for (let i = 0; i < count; i++) {
    if (cloth.pinned[i]) continue;
    const i3 = i * 3;
    const vx = (pos[i3] - prev[i3]) * damping;
    const vy = (pos[i3 + 1] - prev[i3 + 1]) * damping;
    const vz = (pos[i3 + 2] - prev[i3 + 2]) * damping;

    prev[i3] = pos[i3];
    prev[i3 + 1] = pos[i3 + 1];
    prev[i3 + 2] = pos[i3 + 2];

    pos[i3] += vx;
    pos[i3 + 1] += vy;
    pos[i3 + 2] += vz;
  }

  // Constraint relaxation (Gauss-Seidel)
  const constraints = cloth.constraints;
  for (let iter = 0; iter < iterations; iter++) {
    for (let ci = 0; ci < constraints.length; ci++) {
      const { i, j, restLength } = constraints[ci];
      const i3 = i * 3;
      const j3 = j * 3;

      const dx = pos[j3] - pos[i3];
      const dy = pos[j3 + 1] - pos[i3 + 1];
      const dz = pos[j3 + 2] - pos[i3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 1e-6) continue;

      const diff = (dist - restLength) / dist;
      const cx = dx * 0.5 * diff;
      const cy = dy * 0.5 * diff;
      const cz = dz * 0.5 * diff;

      const pi = cloth.pinned[i];
      const pj = cloth.pinned[j];

      if (pi && pj) continue;
      if (pi) {
        pos[j3] -= cx * 2;
        pos[j3 + 1] -= cy * 2;
        pos[j3 + 2] -= cz * 2;
      } else if (pj) {
        pos[i3] += cx * 2;
        pos[i3 + 1] += cy * 2;
        pos[i3 + 2] += cz * 2;
      } else {
        pos[i3] += cx;
        pos[i3 + 1] += cy;
        pos[i3 + 2] += cz;
        pos[j3] -= cx;
        pos[j3 + 1] -= cy;
        pos[j3 + 2] -= cz;
      }
    }
  }
}

/**
 * Push particles out of collision spheres (mannequin body).
 * @param {Cloth} cloth
 * @param {{ x: number, y: number, z: number, r: number }[]} spheres
 */
export function collideWithSpheres(cloth, spheres) {
  const count = cloth.cols * cloth.rows;
  const pos = cloth.positions;
  const margin = 0.3; // small offset so cloth doesn't sit exactly on surface

  for (let i = 0; i < count; i++) {
    if (cloth.pinned[i]) continue;
    const i3 = i * 3;
    const px = pos[i3];
    const py = pos[i3 + 1];
    const pz = pos[i3 + 2];

    for (let s = 0; s < spheres.length; s++) {
      const sp = spheres[s];
      const dx = px - sp.x;
      const dy = py - sp.y;
      const dz = pz - sp.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const minDist = sp.r + margin;

      if (dist < minDist && dist > 1e-6) {
        const factor = minDist / dist;
        pos[i3] = sp.x + dx * factor;
        pos[i3 + 1] = sp.y + dy * factor;
        pos[i3 + 2] = sp.z + dz * factor;
      }
    }
  }
}

/**
 * Add seam constraints between two cloth edges.
 * Connects particles from edge A to edge B with zero rest length.
 * @param {Cloth} clothA
 * @param {number[]} indicesA - particle indices on cloth A
 * @param {Cloth} clothB
 * @param {number[]} indicesB - particle indices on cloth B
 * @returns {{ i: number, j: number, restLength: number, clothA: Cloth, clothB: Cloth }[]}
 */
export function createSeamConstraints(clothA, indicesA, clothB, indicesB) {
  const seams = [];
  const count = Math.min(indicesA.length, indicesB.length);
  for (let k = 0; k < count; k++) {
    seams.push({
      i: indicesA[k],
      j: indicesB[k],
      restLength: 0,
      clothA,
      clothB,
    });
  }
  return seams;
}

/**
 * Solve seam constraints between two different cloths.
 * @param {{ i: number, j: number, restLength: number, clothA: Cloth, clothB: Cloth }[]} seams
 * @param {number} iterations
 */
export function solveSeams(seams, iterations) {
  for (let iter = 0; iter < iterations; iter++) {
    for (const seam of seams) {
      const posA = seam.clothA.positions;
      const posB = seam.clothB.positions;
      const i3 = seam.i * 3;
      const j3 = seam.j * 3;

      const dx = posB[j3] - posA[i3];
      const dy = posB[j3 + 1] - posA[i3 + 1];
      const dz = posB[j3 + 2] - posA[i3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 1e-6) continue;

      const half = 0.5;
      const cx = dx * half;
      const cy = dy * half;
      const cz = dz * half;

      const pi = seam.clothA.pinned[seam.i];
      const pj = seam.clothB.pinned[seam.j];

      if (pi && pj) continue;
      if (pi) {
        posB[j3] -= cx * 2;
        posB[j3 + 1] -= cy * 2;
        posB[j3 + 2] -= cz * 2;
      } else if (pj) {
        posA[i3] += cx * 2;
        posA[i3 + 1] += cy * 2;
        posA[i3 + 2] += cz * 2;
      } else {
        posA[i3] += cx;
        posA[i3 + 1] += cy;
        posA[i3 + 2] += cz;
        posB[j3] -= cx;
        posB[j3 + 1] -= cy;
        posB[j3 + 2] -= cz;
      }
    }
  }
}
