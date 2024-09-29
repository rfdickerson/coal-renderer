#version 450
#extension GL_ARB_separate_shader_objects : enable

// Specify the descriptor set and binding for the uniform buffer
//layout(set = 0, binding = 0) uniform Camera {
//    vec3 uCameraPos;      // Camera position in world space
//    vec3 uCameraTarget;   // Point the camera is looking at
//    vec3 uCameraUp;       // Up direction for the camera
//    float uFOV;           // Field of view in degrees
//    vec2 uResolution;     // Screen resolution
//} camera;

struct Camera {
    vec3 uCameraPos;      // Camera position in world space
    vec3 uCameraTarget;   // Point the camera is looking at
    vec3 uCameraUp;       // Up direction for the camera
    float uFOV;           // Field of view in degrees
    vec2 uResolution;     // Screen resolution
};


// Input from vertex shader
layout(location = 0) in vec2 fragUV;

// Output color
layout(location = 0) out vec4 outColor;

// Constants
const int MAX_STEPS = 100;
const float MAX_DISTANCE = 100.0;
const float SURFACE_DIST = 0.001;

// SDF for a sphere centered at origin with radius 1.0
float sdfSphere(vec3 p, float radius) {
    return length(p) - radius;
}

// Ray marching algorithm
float rayMarch(vec3 ro, vec3 rd) {
    float distanceTraveled = 0.0;
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 currentPos = ro + rd * distanceTraveled;
        float distanceToScene = sdfSphere(currentPos, 1.0);
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
    float dx = sdfSphere(p + vec3(eps, 0.0, 0.0), 1.0) - sdfSphere(p - vec3(eps, 0.0, 0.0), 1.0);
    float dy = sdfSphere(p + vec3(0.0, eps, 0.0), 1.0) - sdfSphere(p - vec3(0.0, eps, 0.0), 1.0);
    float dz = sdfSphere(p + vec3(0.0, 0.0, eps), 1.0) - sdfSphere(p - vec3(0.0, 0.0, eps), 1.0);
    return normalize(vec3(dx, dy, dz));
}

void main() {

    Camera camera;
    camera. uCameraPos = vec3(0.0,0.0, 5.0);      // Camera position in world space
    camera. uCameraTarget = vec3(0.0, 0.0, 0.0);   // Point the camera is looking at
    camera. uCameraUp = vec3(0.0, 1.0, 0.0);       // Up direction for the camera
    camera. uFOV = 45.0f;           // Field of view in degrees
    camera. uResolution = vec2(1024, 1024);     // Screen resolution

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

        // Ambient, diffuse, and specular colors
        vec3 ambient = vec3(0.1);
        vec3 diffuse = vec3(0.6) * diff;
        vec3 specular = vec3(0.3) * spec;

        vec3 color = ambient + diffuse + specular;

        outColor = vec4(color, 1.0);
    } else {
        // Background color
        outColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}