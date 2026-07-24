import * as THREE from 'three';
import { createPrototypeResident, getResidentColor, PrototypeResident } from '../prototype/ResidentAppearance';

type MotionKind = 'none' | 'armLeft' | 'armRight' | 'legLeft' | 'legRight' | 'skirtLegLeft' | 'skirtLegRight';

interface Part {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
  motion: MotionKind;
  pivotX?: number;
  pivotY?: number;
  pivotZ?: number;
  rotationX?: number;
}

interface ResidentLayout {
  id: string;
  resident: PrototypeResident;
  phase: number;
  position: THREE.Vector3;
  rotationY: number;
  scale: number;
  walking: boolean;
  boxes: Part[];
  tapered: Part[];
  faceted: Part[];
  wedges: Part[];
  glasses: Part[];
}

export interface PoolMetrics {
  boxInstances: number;
  taperedInstances: number;
  facetedInstances: number;
  wedgeInstances: number;
  glassesInstances: number;
}

const MAX_BOX_PARTS = 18;
const MAX_TAPERED_PARTS = 12;
const MAX_FACETED_PARTS = 5;
const MAX_WEDGE_PARTS = 3;
const MAX_GLASSES_PARTS = 2;
const HIDDEN_SCALE = 0.00001;

function createToonGradient(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([45, 135, 255]), 3, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeMaterial(gradientMap: THREE.Texture): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap });
}

function createTaperedPrismGeometry(topWidth: number, bottomWidth: number, topDepth: number, bottomDepth: number): THREE.BufferGeometry {
  const topX = topWidth / 2;
  const bottomX = bottomWidth / 2;
  const topZ = topDepth / 2;
  const bottomZ = bottomDepth / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -bottomX, -0.5, -bottomZ, bottomX, -0.5, -bottomZ, bottomX, -0.5, bottomZ, -bottomX, -0.5, bottomZ,
    -topX, 0.5, -topZ, topX, 0.5, -topZ, topX, 0.5, topZ, -topX, 0.5, topZ,
  ], 3));
  geometry.setIndex([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 5, 1, 0, 4, 5,
    1, 6, 2, 1, 5, 6,
    2, 7, 3, 2, 6, 7,
    3, 4, 0, 3, 7, 4,
  ]);
  const faceted = geometry.toNonIndexed();
  geometry.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

function createChamferedBlockGeometry(): THREE.BufferGeometry {
  const corner = 0.16;
  const shape = new THREE.Shape();
  shape.moveTo(-0.5 + corner, -0.5);
  shape.lineTo(0.5 - corner, -0.5);
  shape.lineTo(0.5, -0.5 + corner);
  shape.lineTo(0.5, 0.5 - corner);
  shape.lineTo(0.5 - corner, 0.5);
  shape.lineTo(-0.5 + corner, 0.5);
  shape.lineTo(-0.5, 0.5 - corner);
  shape.lineTo(-0.5, -0.5 + corner);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.86,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.045,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geometry.center();
  const faceted = geometry.toNonIndexed();
  geometry.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

function addPart(parts: Part[], x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, motion: MotionKind = 'none', pivot?: THREE.Vector3, rotationX = 0): void {
  parts.push({ x, y, z, sx, sy, sz, color, motion, pivotX: pivot?.x, pivotY: pivot?.y, pivotZ: pivot?.z, rotationX });
}

export class CitizenRenderPool {
  private readonly boxes: THREE.InstancedMesh;
  private readonly tapered: THREE.InstancedMesh;
  private readonly faceted: THREE.InstancedMesh;
  private readonly wedges: THREE.InstancedMesh;
  private readonly glasses: THREE.InstancedMesh;
  private readonly gradient = createToonGradient();
  private readonly boxCapacity: number;
  private readonly taperedCapacity: number;
  private readonly facetedCapacity: number;
  private readonly wedgeCapacity: number;
  private readonly glassesCapacity: number;
  private layouts: Array<ResidentLayout | null>;
  private readonly slots = new Map<string, number>();
  private animationTime = 0;

  private readonly axisX = new THREE.Vector3(1, 0, 0);
  private readonly axisY = new THREE.Vector3(0, 1, 0);
  private readonly rootPosition = new THREE.Vector3();
  private readonly rootScale = new THREE.Vector3();
  private readonly localPosition = new THREE.Vector3();
  private readonly localScale = new THREE.Vector3();
  private readonly pivotPosition = new THREE.Vector3();
  private readonly offsetPosition = new THREE.Vector3();
  private readonly rootQuaternion = new THREE.Quaternion();
  private readonly localQuaternion = new THREE.Quaternion();
  private readonly pivotQuaternion = new THREE.Quaternion();
  private readonly rootMatrix = new THREE.Matrix4();
  private readonly localMatrix = new THREE.Matrix4();
  private readonly worldMatrix = new THREE.Matrix4();
  private readonly pivotMatrix = new THREE.Matrix4();
  private readonly rotationMatrix = new THREE.Matrix4();
  private readonly offsetScaleMatrix = new THREE.Matrix4();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(HIDDEN_SCALE, HIDDEN_SCALE, HIDDEN_SCALE);
  private readonly color = new THREE.Color();
  private readonly parent: THREE.Object3D;

  constructor(parent: THREE.Object3D, maxResidents: number) {
    this.parent = parent;
    this.boxCapacity = maxResidents * MAX_BOX_PARTS;
    this.taperedCapacity = maxResidents * MAX_TAPERED_PARTS;
    this.facetedCapacity = maxResidents * MAX_FACETED_PARTS;
    this.wedgeCapacity = maxResidents * MAX_WEDGE_PARTS;
    this.glassesCapacity = maxResidents * MAX_GLASSES_PARTS;

    this.boxes = this.createPool(new THREE.BoxGeometry(1, 1, 1), this.boxCapacity);
    this.tapered = this.createPool(createTaperedPrismGeometry(0.96, 0.72, 0.88, 0.72), this.taperedCapacity);
    this.faceted = this.createPool(createChamferedBlockGeometry(), this.facetedCapacity);
    this.wedges = this.createPool(createTaperedPrismGeometry(0.56, 1, 0.72, 0.9), this.wedgeCapacity);
    this.glasses = this.createPool(new THREE.TorusGeometry(0.5, 0.035, 3, 8), this.glassesCapacity);
    this.layouts = Array.from({ length: maxResidents }, () => null);

    parent.add(this.boxes, this.tapered, this.faceted, this.wedges, this.glasses);
    this.hideUnused(this.boxes, this.boxCapacity);
    this.hideUnused(this.tapered, this.taperedCapacity);
    this.hideUnused(this.faceted, this.facetedCapacity);
    this.hideUnused(this.wedges, this.wedgeCapacity);
    this.hideUnused(this.glasses, this.glassesCapacity);
  }

  registerResident(id: string, appearanceSeed: number): void {
    if (this.slots.has(id)) return;
    const slot = this.layouts.findIndex(layout => layout === null);
    if (slot === -1) throw new Error('Resident render pool capacity reached');
    this.layouts[slot] = this.createLayout(createPrototypeResident(appearanceSeed, 0), slot, id);
    this.slots.set(id, slot);
    this.writeColors();
  }

  unregisterResident(id: string): void {
    const slot = this.slots.get(id);
    if (slot === undefined) return;
    this.layouts[slot] = null;
    this.slots.delete(id);
    this.writeColors();
  }

  setResidentTransform(id: string, position: THREE.Vector3, rotationY: number, scale: number, walking: boolean): void {
    const slot = this.slots.get(id);
    const layout = slot === undefined ? null : this.layouts[slot];
    if (!layout) return;
    layout.position.copy(position);
    layout.rotationY = rotationY;
    layout.scale = scale;
    layout.walking = walking;
  }

  update(deltaTime: number): void {
    this.animationTime += deltaTime;
    for (let index = 0; index < this.layouts.length; index++) {
      const layout = this.layouts[index]!;
      if (!layout) continue;
      const gait = layout.walking ? Math.sin(this.animationTime * 9 + layout.phase) : 0;
      const bob = layout.walking ? Math.abs(gait) * 0.024 : 0;
      this.rootPosition.copy(layout.position);
      this.rootPosition.y += bob;
      this.rootScale.setScalar(layout.resident.appearance.body.height * layout.scale);
      this.rootQuaternion.setFromAxisAngle(this.axisY, layout.rotationY);
      this.rootMatrix.compose(this.rootPosition, this.rootQuaternion, this.rootScale);

      this.writePartMatrices(this.boxes, index * MAX_BOX_PARTS, MAX_BOX_PARTS, layout.boxes, gait);
      this.writePartMatrices(this.tapered, index * MAX_TAPERED_PARTS, MAX_TAPERED_PARTS, layout.tapered, gait);
      this.writePartMatrices(this.faceted, index * MAX_FACETED_PARTS, MAX_FACETED_PARTS, layout.faceted, gait);
      this.writePartMatrices(this.wedges, index * MAX_WEDGE_PARTS, MAX_WEDGE_PARTS, layout.wedges, gait);
      this.writePartMatrices(this.glasses, index * MAX_GLASSES_PARTS, MAX_GLASSES_PARTS, layout.glasses, gait);
    }
    this.boxes.instanceMatrix.needsUpdate = true;
    this.tapered.instanceMatrix.needsUpdate = true;
    this.faceted.instanceMatrix.needsUpdate = true;
    this.wedges.instanceMatrix.needsUpdate = true;
    this.glasses.instanceMatrix.needsUpdate = true;
  }

  getMetrics(): PoolMetrics {
    return {
      boxInstances: this.layouts.reduce((total, layout) => total + (layout?.boxes.length ?? 0), 0),
      taperedInstances: this.layouts.reduce((total, layout) => total + (layout?.tapered.length ?? 0), 0),
      facetedInstances: this.layouts.reduce((total, layout) => total + (layout?.faceted.length ?? 0), 0),
      wedgeInstances: this.layouts.reduce((total, layout) => total + (layout?.wedges.length ?? 0), 0),
      glassesInstances: this.layouts.reduce((total, layout) => total + (layout?.glasses.length ?? 0), 0),
    };
  }

  getPoolCount(): number {
    return 5;
  }

  dispose(): void {
    this.parent.remove(this.boxes, this.tapered, this.faceted, this.wedges, this.glasses);
    this.boxes.geometry.dispose();
    this.tapered.geometry.dispose();
    this.faceted.geometry.dispose();
    this.wedges.geometry.dispose();
    this.glasses.geometry.dispose();
    (this.boxes.material as THREE.Material).dispose();
    (this.tapered.material as THREE.Material).dispose();
    (this.faceted.material as THREE.Material).dispose();
    (this.wedges.material as THREE.Material).dispose();
    (this.glasses.material as THREE.Material).dispose();
    this.gradient.dispose();
  }

  private createPool(geometry: THREE.BufferGeometry, capacity: number): THREE.InstancedMesh {
    const pool = new THREE.InstancedMesh(geometry, makeMaterial(this.gradient), capacity);
    pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pool.castShadow = true;
    pool.receiveShadow = false;
    pool.frustumCulled = false;
    return pool;
  }

  private hideUnused(pool: THREE.InstancedMesh, capacity: number): void {
    for (let index = 0; index < capacity; index++) {
      pool.setMatrixAt(index, this.hiddenMatrix);
      pool.setColorAt(index, this.color.set('#ffffff'));
    }
    pool.instanceMatrix.needsUpdate = true;
    if (pool.instanceColor) pool.instanceColor.needsUpdate = true;
  }

  private createLayout(resident: PrototypeResident, index: number, id: string): ResidentLayout {
    const boxes: Part[] = [];
    const tapered: Part[] = [];
    const faceted: Part[] = [];
    const wedges: Part[] = [];
    const glasses: Part[] = [];
    const { appearance } = resident;
    const skin = getResidentColor(appearance.skin);
    const hair = getResidentColor(appearance.hair.color);
    const top = getResidentColor(appearance.outfit.top);
    const bottom = getResidentColor(appearance.outfit.bottom);
    const accent = getResidentColor(appearance.outfit.accent);
    const shoes = getResidentColor(appearance.outfit.shoes);
    const ink = getResidentColor('ink');
    const shoulder = appearance.body.shoulderWidth;
    const hip = appearance.body.hipWidth;
    const legHeight = 0.5 * appearance.body.legRatio;
    const coveredLegHeight = 0.24;
    const isSkirted = appearance.outfit.family === 'dress' || appearance.outfit.family === 'skirt';
    const isOveralls = appearance.outfit.family === 'overalls';
    const isOuterwear = appearance.outfit.family === 'jacket' || appearance.outfit.family === 'cardigan';
    const sleeveColor = isOuterwear ? accent : top;
    const visibleLegHeight = isSkirted ? coveredLegHeight : legHeight;
    const visibleLegY = isSkirted ? 0.14 : 0.3;
    // Overalls are a complete garment: the bib, straps, and both trouser legs
    // deliberately share one color. Keeping the legs as two separate shells
    // preserves the central trouser gap even during the walk cycle.
    const visibleLegColor = isSkirted ? skin : isOveralls ? accent : bottom;
    const legWidth = isOveralls ? 0.31 * hip : 0.17 * hip;
    const legOffset = isOveralls ? 0.18 * hip : 0.17 * hip;
    const leftLegMotion: MotionKind = isSkirted ? 'skirtLegLeft' : 'legLeft';
    const rightLegMotion: MotionKind = isSkirted ? 'skirtLegRight' : 'legRight';
    const footY = isSkirted ? 0.045 : 0.06;
    // Each moving volume begins inside its parent volume. This keeps the character
    // readable as a single low-poly figure, even at the widest walk-cycle pose.
    const leftHip = new THREE.Vector3(-legOffset, 0.56, 0);
    const rightHip = new THREE.Vector3(legOffset, 0.56, 0);
    const leftShoulder = new THREE.Vector3(-0.28 * shoulder, 0.96, 0);
    const rightShoulder = new THREE.Vector3(0.28 * shoulder, 0.96, 0);

    // Overalls use two adjoining torso shells rather than a large front overlay:
    // shirt above, full-depth workwear around the waist below. The lower shell
    // therefore reads from the side and back too, without cutting into the legs.
    if (isOveralls) {
      addPart(tapered, 0, 0.88, 0, 0.5 * shoulder, 0.27, 0.31, top);
      addPart(tapered, 0, 0.62, 0, 0.37 * hip, 0.25, 0.33, accent);
    } else {
      addPart(tapered, 0, 0.76, 0, 0.5 * shoulder, 0.5, 0.31, top);
    }
    addPart(faceted, 0, 1.2, 0.02, 0.42 * appearance.body.headScale, 0.37 * appearance.body.headScale, 0.34, skin);
    addPart(tapered, -legOffset, visibleLegY, 0, legWidth, visibleLegHeight, 0.18, visibleLegColor, leftLegMotion, leftHip);
    addPart(tapered, legOffset, visibleLegY, 0, legWidth, visibleLegHeight, 0.18, visibleLegColor, rightLegMotion, rightHip);
    addPart(tapered, -legOffset, footY, 0.11, 0.17 * hip, 0.3, 0.1, shoes, leftLegMotion, leftHip, Math.PI / 2);
    addPart(tapered, legOffset, footY, 0.11, 0.17 * hip, 0.3, 0.1, shoes, rightLegMotion, rightHip, Math.PI / 2);
    addPart(tapered, -0.28 * shoulder, 0.74, 0, 0.14 * shoulder, 0.46, 0.18, sleeveColor, 'armLeft', leftShoulder);
    addPart(tapered, 0.28 * shoulder, 0.74, 0, 0.14 * shoulder, 0.46, 0.18, sleeveColor, 'armRight', rightShoulder);
    addPart(tapered, -0.29 * shoulder, 0.5, 0.02, 0.105 * shoulder, 0.18, 0.13, skin, 'armLeft', leftShoulder);
    addPart(tapered, 0.29 * shoulder, 0.5, 0.02, 0.105 * shoulder, 0.18, 0.13, skin, 'armRight', rightShoulder);

    // Hair and facial details are slightly embedded in the head shell instead of
    // hovering in front of it; their forward-most facets still remain visible.
    if (appearance.hair.style === 'crop') addPart(faceted, 0, 1.36, -0.03, 0.46, 0.2, 0.38, hair);
    if (appearance.hair.style === 'block') addPart(faceted, 0, 1.37, -0.03, 0.51, 0.23, 0.4, hair);
    if (appearance.hair.style === 'bob') {
      addPart(faceted, 0, 1.36, -0.03, 0.46, 0.2, 0.38, hair);
      addPart(faceted, -0.24, 1.22, 0, 0.21, 0.32, 0.34, hair);
      addPart(faceted, 0.24, 1.22, 0, 0.21, 0.32, 0.34, hair);
      // Close the lower rear of the head between the two locks. This is kept
      // slightly inside the head shell so it reads as a continuous bob rather
      // than a floating panel when the resident turns away from the camera.
      addPart(faceted, 0, 1.14, -0.135, 0.41, 0.34, 0.12, hair);
    }
    if (appearance.hair.style === 'bun') {
      addPart(faceted, 0, 1.36, -0.03, 0.46, 0.2, 0.38, hair);
      addPart(faceted, -0.2, 1.4, -0.04, 0.24, 0.24, 0.24, hair);
    }
    if (appearance.hair.style === 'cap') addPart(faceted, 0, 1.38, -0.03, 0.5, 0.24, 0.41, hair);

    addPart(boxes, -0.11, 1.21, 0.176, 0.042, 0.062, 0.02, ink);
    addPart(boxes, 0.11, 1.21, 0.176, 0.042, 0.062, 0.02, ink);
    addPart(boxes, 0, 1.15, 0.185, 0.07, 0.05, 0.055, skin);
    if (appearance.face.moustache) addPart(boxes, 0, 1.09, 0.185, 0.2, 0.035, 0.02, hair);
    if (appearance.face.glasses) {
      addPart(glasses, -0.12, 1.21, 0.194, 0.105, 0.098, 0.022, ink);
      addPart(glasses, 0.12, 1.21, 0.194, 0.105, 0.098, 0.022, ink);
      addPart(boxes, 0, 1.21, 0.196, 0.07, 0.015, 0.018, ink);
    }

    if (isOuterwear) {
      // Three close-fitting shell pieces wrap the back and sides of the shirt.
      // The central front remains open, so the underlayer stays readable.
      addPart(tapered, 0, 0.76, -0.145, 0.5 * shoulder, 0.5, 0.07, accent);
      addPart(tapered, -0.24 * shoulder, 0.77, 0.005, 0.16 * shoulder, 0.52, 0.31, accent);
      addPart(tapered, 0.24 * shoulder, 0.77, 0.005, 0.16 * shoulder, 0.52, 0.31, accent);
    }
    if (isOveralls) {
      // The waist shell supplies the overall body; only close-fitting straps
      // are needed above it. Their lower edge lands exactly on the shell.
      addPart(boxes, -0.16 * shoulder, 0.85, 0.16, 0.05, 0.21, 0.026, accent);
      addPart(boxes, 0.16 * shoulder, 0.85, 0.16, 0.05, 0.21, 0.026, accent);
      addPart(boxes, -0.16 * shoulder, 0.79, 0.19, 0.06, 0.04, 0.018, top);
      addPart(boxes, 0.16 * shoulder, 0.79, 0.19, 0.06, 0.04, 0.018, top);
    }
    if (appearance.outfit.family === 'dress') {
      addPart(wedges, 0, 0.44, 0, 0.72 * hip, 0.56, 0.36, bottom);
    }
    if (appearance.outfit.family === 'skirt') addPart(wedges, 0, 0.45, 0, 0.68 * hip, 0.58, 0.34, bottom);

    if (appearance.signature === 'seed pouch') addPart(boxes, 0.32 * hip, 0.52, 0.17, 0.17, 0.2, 0.1, accent);
    if (appearance.signature === 'satchel') {
      addPart(boxes, 0.33 * shoulder, 0.52, 0.16, 0.21, 0.25, 0.1, accent);
      addPart(boxes, 0.1 * shoulder, 0.78, 0.15, 0.04, 0.5, 0.03, accent);
    }
    if (appearance.signature === 'book bag') addPart(boxes, 0.34 * shoulder, 0.5, -0.1, 0.23, 0.29, 0.14, accent);

    return { id, resident, phase: index * 0.77, position: new THREE.Vector3(), rotationY: 0, scale: 1, walking: false, boxes, tapered, faceted, wedges, glasses };
  }

  private writeColors(): void {
    this.hideUnused(this.boxes, this.boxCapacity);
    this.hideUnused(this.tapered, this.taperedCapacity);
    this.hideUnused(this.faceted, this.facetedCapacity);
    this.hideUnused(this.wedges, this.wedgeCapacity);
    this.hideUnused(this.glasses, this.glassesCapacity);
    this.layouts.forEach((layout, index) => {
      if (!layout) return;
      this.writePartColors(this.boxes, index * MAX_BOX_PARTS, layout.boxes);
      this.writePartColors(this.tapered, index * MAX_TAPERED_PARTS, layout.tapered);
      this.writePartColors(this.faceted, index * MAX_FACETED_PARTS, layout.faceted);
      this.writePartColors(this.wedges, index * MAX_WEDGE_PARTS, layout.wedges);
      this.writePartColors(this.glasses, index * MAX_GLASSES_PARTS, layout.glasses);
    });
    [this.boxes, this.tapered, this.faceted, this.wedges, this.glasses].forEach(pool => {
      if (pool.instanceColor) pool.instanceColor.needsUpdate = true;
    });
  }

  private writePartColors(pool: THREE.InstancedMesh, offset: number, parts: Part[]): void {
    parts.forEach((part, index) => pool.setColorAt(offset + index, this.color.set(part.color)));
  }

  private writePartMatrices(pool: THREE.InstancedMesh, offset: number, maxParts: number, parts: Part[], gait: number): void {
    for (let index = 0; index < maxParts; index++) {
      const part = parts[index];
      if (!part) {
        pool.setMatrixAt(offset + index, this.hiddenMatrix);
        continue;
      }
      const swing = part.motion === 'legLeft' ? gait * 0.58
        : part.motion === 'legRight' ? -gait * 0.58
          : part.motion === 'skirtLegLeft' ? gait * 0.13
            : part.motion === 'skirtLegRight' ? -gait * 0.13
          : part.motion === 'armLeft' ? -gait * 0.3
            : part.motion === 'armRight' ? gait * 0.3
              : 0;
      this.localScale.set(part.sx, part.sy, part.sz);
      // Static orientation belongs to the primitive itself (for example, a shoe
      // pointed forward). Only the joint's transform receives walk-cycle swing.
      this.localQuaternion.setFromAxisAngle(this.axisX, part.rotationX ?? 0);

      if (part.pivotY === undefined) {
        this.localPosition.set(part.x, part.y, part.z);
        this.localMatrix.compose(this.localPosition, this.localQuaternion, this.localScale);
      } else {
        this.pivotPosition.set(part.pivotX!, part.pivotY, part.pivotZ!);
        this.offsetPosition.set(part.x - part.pivotX!, part.y - part.pivotY, part.z - part.pivotZ!);
        this.pivotMatrix.makeTranslation(this.pivotPosition.x, this.pivotPosition.y, this.pivotPosition.z);
        this.pivotQuaternion.setFromAxisAngle(this.axisX, swing);
        this.rotationMatrix.makeRotationFromQuaternion(this.pivotQuaternion);
        this.offsetScaleMatrix.compose(this.offsetPosition, this.localQuaternion, this.localScale);
        this.localMatrix.multiplyMatrices(this.pivotMatrix, this.rotationMatrix).multiply(this.offsetScaleMatrix);
      }
      this.worldMatrix.multiplyMatrices(this.rootMatrix, this.localMatrix);
      pool.setMatrixAt(offset + index, this.worldMatrix);
    }
  }
}
