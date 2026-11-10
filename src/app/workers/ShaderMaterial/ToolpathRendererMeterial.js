import * as THREE from 'three';

export const UNIFORMS = {
    // rgba
    u_g1_color: new THREE.Uniform(new THREE.Vector4(0, 0, 0, 1)),
    u_select_color: new THREE.Uniform(new THREE.Vector4(0.156, 0.655, 0.882, 1)),
    u_selected: { value: false },
    // CNC lines keep their own color when selected. Laser still shifts toward blue.
    u_keep_hue: { value: false }
};

export const CNC_LASER_VERT_SHADER = [
    'uniform bool u_selected;',
    'varying float v_g_code;',
    'varying vec3 v_color;',
    'attribute float a_g_code;',
    'attribute vec3 a_color;',
    'void main(){',
    '    v_g_code = a_g_code;',
    '    v_color = a_color;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '    gl_PointSize = 1.0;',
    '}'
].join('');

export const CNC_LASER_FRAG_SELECT_SHADER = [
    'uniform bool u_selected;',
    'uniform bool u_keep_hue;',
    'uniform vec4 u_g1_color;',
    'uniform vec4 u_select_color;',
    'varying float v_g_code;',
    'varying vec3 v_color;',
    'void main(){',
    '    if(v_g_code == 0.0){',
    '        discard;',
    '    }',
    '    if(u_selected && u_keep_hue){',
    '        gl_FragColor = vec4(min(v_color + vec3(0.18), vec3(1.0)), 1.0);',
    '    } else if(u_selected){',
    '        gl_FragColor = vec4(v_color.x*0.92, v_color.y * 0.53 + 0.47, 1, 1.0);',
    '    } else {',
    '        gl_FragColor = vec4(v_color.xyz, 1.0);',
    '    };',
    '}'
].join('');

export const MATERIAL_SELECTED = new THREE.ShaderMaterial({
    uniforms: UNIFORMS,
    vertexShader: CNC_LASER_VERT_SHADER,
    fragmentShader: CNC_LASER_FRAG_SELECT_SHADER,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    linewidth: 1
});

// One material per line. The preview used to share MATERIAL_SELECTED, so
// selecting any path turned every path the same blue.
export function createToolpathMaterial(selected = false, keepHue = false) {
    return new THREE.ShaderMaterial({
        uniforms: {
            u_g1_color: new THREE.Uniform(new THREE.Vector4(0, 0, 0, 1)),
            u_select_color: new THREE.Uniform(new THREE.Vector4(0.156, 0.655, 0.882, 1)),
            u_selected: { value: selected },
            u_keep_hue: { value: keepHue }
        },
        vertexShader: CNC_LASER_VERT_SHADER,
        fragmentShader: CNC_LASER_FRAG_SELECT_SHADER,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        linewidth: 1
    });
}
