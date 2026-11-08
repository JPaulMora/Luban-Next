import * as THREE from 'three';
import { DEFAULT_LUBAN_HOST } from '../../constants';

/**
 * Renders a solid Boolean carve mesh (stock − swept bit) with the wood material.
 */
export class SolidSimRenderer {
    async render(solidSim) {
        await this._generateTexture();
        const geometry = new THREE.BufferGeometry();
        const positions = solidSim.positions || [];
        const normals = solidSim.normals || [];
        const indices = solidSim.indices || [];

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        if (normals.length === positions.length) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        } else {
            geometry.computeVertexNormals();
        }
        if (indices.length > 0) {
            geometry.setIndex(indices);
        }

        const material = new THREE.MeshPhongMaterial({
            color: '#cea775',
            shininess: 0,
            map: this.texture || null,
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(mesh);
        return group;
    }

    _generateTexture() {
        return new Promise((resolve) => {
            this.texture = new THREE.TextureLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/wood.png`, () => {
                resolve();
            }, undefined, () => resolve());
        });
    }
}
