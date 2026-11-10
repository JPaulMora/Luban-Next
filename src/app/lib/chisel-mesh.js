import * as THREE from 'three';

export function cncChiselOptions(headType, config = {}, gcodeConfig = {}) {
    if (headType !== 'cnc') {
        return {};
    }
    const targetDepth = Number(gcodeConfig.targetDepth);
    const steepAngle = Number(config.steepAngle);
    const shallowAngle = Number(config.shallowAngle);
    return {
        chisel: true,
        targetDepth: targetDepth > 0 ? targetDepth : 2,
        steepAngle: steepAngle > 0 ? steepAngle : 70,
        shallowAngle: shallowAngle > 0 ? shallowAngle : 28
    };
}

export function ensureChiselScale(model, sourceWidth, displayWidth) {
    if (!model || model.scale || !(sourceWidth > 0) || !(displayWidth > 0)) {
        return;
    }
    model.scale = displayWidth / sourceWidth;
}

export function attachChiselMesh(model, letters) {
    if (!model) {
        return;
    }
    const positions = [];
    if (Array.isArray(letters)) {
        letters.forEach((letter) => {
            if (Array.isArray(letter)) {
                positions.push(...letter);
            }
        });
    }
    if (positions.length < 9) {
        if (Array.isArray(letters) && model.image3dObj) {
            if (model.image3dObj.parent) {
                model.image3dObj.parent.remove(model.image3dObj);
            }
            model.image3dObj = null;
        }
        return;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
        color: 0xa0a0a0,
        specular: 0xb0b0b0,
        shininess: 0
    }));
    if (model.image3dObj && model.image3dObj.parent) {
        model.image3dObj.parent.remove(model.image3dObj);
    }
    model.image3dObj = mesh;
}
