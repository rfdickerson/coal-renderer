#version 450
#extension GL_ARB_separate_shader_objects : enable

layout(location = 0) in vec2 fragCoord;
layout(location = 0) out vec4 outColor;

const float MAX_DIST = 100.0;
const float EPSILON = 0.001;
const int MAX_STEPS = 100;

// Scene configuration
const vec3 lightPos = vec3(2.0, 4.0, -3.0);
const vec3 cubePos = vec3(0.0, 1.0, 0.0);
const float outerCubeSize = 1.0;
const float innerCubeSize = 0.6; // Size of the inner cube to be subtracted
const vec3 innerCubeOffset = vec3(0.5, 0.5, -0.2); // Offset of the inner cube

// Adjustable Field of View (in degrees)
const float FOV_DEGREES = 60.0; // You can adjust this value (e.g., 45.0, 90.0)
const float FOV = radians(FOV_DEGREES); // Convert to radians

// Calculate aspect ratio (assuming 16:9)
const float ASPECT_RATIO = 16.0 / 9.0;

// Signed Distance Functions
float sdPlane(vec3 p) {
    return p.y;
}

float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

// Cube with off-center cut-out SDF
float sdCubeWithCutout(vec3 p, float outerSize, float innerSize, vec3 innerOffset) {
    float outer = sdBox(p, vec3(outerSize));
    float inner = sdBox(p - innerOffset, vec3(innerSize));
    return max(outer, -inner);
}

// Scene SDF
float sceneSDF(vec3 p) {
    float plane = sdPlane(p);
//    float cubeWithCutout = sdCubeWithCutout(p - cubePos, outerCubeSize, innerCubeSize, innerCubeOffset);
    float cube = sdBox(p - cubePos, vec3(outerCubeSize));
    return min(plane, cube);
}

// Normal estimation
vec3 estimateNormal(vec3 p) {
    return normalize(vec3(
                     sceneSDF(vec3(p.x + EPSILON, p.y, p.z)) - sceneSDF(vec3(p.x - EPSILON, p.y, p.z)),
                     sceneSDF(vec3(p.x, p.y + EPSILON, p.z)) - sceneSDF(vec3(p.x, p.y - EPSILON, p.z)),
                     sceneSDF(vec3(p.x, p.y, p.z + EPSILON)) - sceneSDF(vec3(p.x, p.y, p.z - EPSILON))
                     ));
}

// Ray marching
float rayMarch(vec3 ro, vec3 rd) {
    float depth = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + depth * rd;
        float dist = sceneSDF(p);
        depth += dist;
        if (dist < EPSILON || depth > MAX_DIST) break;
    }
    return depth;
}

// Soft shadows
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for(int i = 0; i < 16; i++) {
        float h = sceneSDF(ro + rd * t);
        if(h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += clamp(h, 0.01, 0.2);
        if(t > maxt) break;
    }
    return res;
}

// Ambient Occlusion
float ambientOcclusion(vec3 p, vec3 n) {

    int numSamples = 16;
    float maxDistance = 0.5;

    float ao = 0.0;
    float scale = 1.0 / float(numSamples);

    for (int i = 1; i <= numSamples; i++) {
        float t = float(i) / float(numSamples) * maxDistance;
        float d = sceneSDF(p + n * t);
        // smooth step
        ao += smoothstep(0.0, 1.0, t - d);

    }

    // normalize and invert ao
    ao = ao * scale;
    ao = clamp(1.0 - ao, 0.0, 1.0);

    return ao;
}

// Checkerboard pattern
float checkerboard(vec2 p) {
    vec2 q = floor(p);
    return mod(q.x + q.y, 2.0);
}

void main() {
    vec2 uv = fragCoord * 2.0 - 1.0;
    uv.x *= ASPECT_RATIO; // Adjust for aspect ratio

    // Camera setup
    vec3 ro = vec3(5.0, 3.0, -5.0); // Camera origin
    vec3 target = cubePos;           // Look-at target (box position)
    vec3 upWorld = vec3(0.0, 1.0, 0.0); // World's up vector

    // Calculate forward, right, and up vectors for the camera
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, upWorld));
    vec3 up = cross(right, forward);

    // Calculate FOV scaling factor
    float scale = tan(FOV * 0.5);

    // Ray direction calculation using the camera's coordinate system
    vec3 rd = normalize(forward + (uv.x * scale) * right + (uv.y * scale) * up);

    float d = rayMarch(ro, rd);

    if (d < MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 normal = estimateNormal(p);
        vec3 lightDir = normalize(lightPos - p);

        // Diffuse lighting
        float diff = max(dot(normal, lightDir), 0.0);

        // Shadows
        float shadow = softShadow(p + normal * EPSILON * 2.0, lightDir, 0.01, 4.0, 32.0);

        // Ambient Occlusion
        float ao = ambientOcclusion(p, normal);

        // Material color
        vec3 color;
        if (p.y < EPSILON + 0.01) {
            // Checkerboard for the plane
            color = vec3(checkerboard(p.xz));
        } else {
            // Cube color
            color = vec3(0.2, 0.4, 0.8);
        }

        // Final color calculation
        vec3 finalColor = color * diff * shadow;

        // Apply ambient occlusion
        finalColor *= ao;

        // Ambient light
        finalColor += 0.1 * color * ao;

        outColor = vec4(finalColor, 1.0);
    } else {
        // Background color
        outColor = vec4(0.7, 0.8, 0.9, 1.0);
    }
}