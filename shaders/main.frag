#version 450
#extension GL_ARB_separate_shader_objects : enable

struct Camera {
    vec3 uCameraPos;      // Camera position in world space
    vec3 uCameraTarget;   // Point the camera is looking at
    vec3 uCameraUp;       // Up direction for the camera
    float uFOV;           // Field of view in degrees
    vec2 uResolution;     // Screen resolution
};

layout(location = 0) in vec2 fragUV;
layout(location = 0) out vec4 outColor;

const int MAX_STEPS = 100;
const float MAX_DISTANCE = 100.0;
const float SURFACE_DIST = 0.001;

// SDF for a sphere centered at origin with radius 1.0
float sdfSphere(vec3 p, float radius) {
    return length(p) - radius;
}

float sdfPlane(vec3 p, vec3 n, float h) {
    return dot(p, n) + h;
}

float sceneSDF(vec3 p) {
    float sphere = sdfSphere(p - vec3(0, 1, 0), 1.0);
    float plane = sdfPlane(p, vec3(0, 1, 0), 0.0);
    return min(sphere, plane);
}

// Checkerboard pattern
float checkerboard(vec2 p) {
    vec2 q = floor(p);
    return mod(q.x + q.y, 2.0);
}

// Ray marching algorithm
float rayMarch(vec3 ro, vec3 rd) {
    float distanceTraveled = 0.0;
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 currentPos = ro + rd * distanceTraveled;
        float distanceToScene = sceneSDF(currentPos);
        if(distanceToScene < SURFACE_DIST) {
            return distanceTraveled;
        }
        if(distanceTraveled > MAX_DISTANCE) {
            break;
        }
        distanceTraveled += distanceToScene;
    }
    return MAX_DISTANCE;
}

// Estimate normal at point p using central differences
vec3 estimateNormal(vec3 p) {
    float eps = 0.0001;
    vec2 e = vec2(eps, 0.0);
    return normalize(vec3(
                     sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
                     sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
                     sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)
                     ));
}

// Soft shadows
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for(int i = 0; i < 16; i++) {
        if(t > maxt) break;
        float h = sceneSDF(ro + rd * t);
        if(h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += h;
    }
    return res;
}

// Get scene color
vec3 getSceneColor(vec3 p) {
    if(p.y < 1.001) {
        float pattern = checkerboard(p.xz * 2.0);
        return vec3(pattern);
    }
    return vec3(0.1, 0.2, 0.3); // Sky color
}

vec3 render(Camera camera, vec2 uv) {

    // Convert fragment coordinates to NDC (Normalized Device Coordinates)
    vec2 ndc = (fragUV * 2.0) - 1.0;
    ndc.x *= camera.uResolution.x / camera.uResolution.y; // Correct for aspect ratio

    // Calculate camera basis vectors
    vec3 forward = normalize(camera.uCameraTarget - camera.uCameraPos);
    vec3 right = normalize(cross(forward, camera.uCameraUp));
    vec3 up = cross(right, forward);

    // Calculate the ray direction
    float fovRad = radians(camera.uFOV);
    vec3 rd = normalize(forward + ndc.x * tan(fovRad / 2.0) * right + ndc.y * tan(fovRad / 2.0) * up);

    // Ray origin
    vec3 ro = camera.uCameraPos;

    // Perform ray marching
    float distance = rayMarch(ro, rd);

    if(distance < MAX_DISTANCE) {
        // Compute the intersection point
        vec3 p = ro + rd * distance;

        // Estimate normal at the intersection point
        vec3 normal = estimateNormal(p);

        // Simple lighting (Phong)
        vec3 lightPos = vec3(5.0, 5.0, 5.0);
        vec3 lightDir = normalize(lightPos - p);
        float diff = max(dot(normal, lightDir), 0.0);

        // Specular component
        vec3 viewDir = normalize(ro - p);
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

        // Shadow calculation
        float shadow = softShadow(p, lightDir, 0.1, 10.0, 8.0);

        vec3 ambient = vec3(0.1);
        vec3 diffuse, color;

        if(p.y < 0.001) {
            float pattern = checkerboard(p.xz * 2.0);
            diffuse = vec3(pattern) * diff;
            color = ambient + diffuse * shadow;
        } else {
            // Pink color for the sphere
            vec3 sphereColor = vec3(1.0, 0.4, 0.7);
            diffuse = sphereColor * diff;
            vec3 specular = vec3(0.3) * spec;

            // Add reflectance
            vec3 reflectRay = reflect(rd, normal);
            float reflectDist = rayMarch(p + normal * 0.01, reflectRay);
            vec3 reflectP = p + reflectRay * reflectDist;
            vec3 reflectionColor = getSceneColor(reflectP);

            float reflectivity = 0.1; // Adjust this value to control reflectance strength
            color = ambient + (diffuse + specular) * shadow + reflectionColor * reflectivity;
        }

        return color;
    } else {
        // Background color
        return vec3(0.1, 0.2, 0.3);
    }
}

void main() {

    Camera camera;
    camera.uCameraPos = vec3(0.0, 3.0, 5.0);      // Camera position in world space
    camera.uCameraTarget = vec3(0.0, 1.0, 0.0);   // Point the camera is looking at
    camera.uCameraUp = vec3(0.0, 1.0, 0.0);       // Up direction for the camera
    camera.uFOV = 45.0f;           // Field of view in degrees
    camera.uResolution = vec2(1024, 1024);     // Screen resolution

    vec3 col = vec3(0.0);

    // 2x2 supersampling
    float dx = 1.0 / camera.uResolution.x;
    float dy = 1.0 / camera.uResolution.y;

    col += render(camera, fragUV + vec2(-0.25 * dx, -0.25 * dy));
    col += render(camera, fragUV + vec2(-0.25 * dx,  0.25 * dy));
    col += render(camera, fragUV + vec2( 0.25 * dx, -0.25 * dy));
    col += render(camera, fragUV + vec2( 0.25 * dx,  0.25 * dy));

    col /= 4.0; // Average the samples

    // Apply gamma correction
    float gamma = 2.2;
    col = pow(col, vec3(gamma));


    outColor = vec4(col, 1.0);
}