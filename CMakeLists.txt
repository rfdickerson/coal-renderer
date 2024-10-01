cmake_minimum_required(VERSION 3.10)

project(HelloWorld)

find_package(Vulkan REQUIRED)
find_package(fmt CONFIG REQUIRED)
find_package(vk-bootstrap CONFIG REQUIRED)
find_package(glfw3 CONFIG REQUIRED)
find_package(VulkanMemoryAllocator CONFIG REQUIRED)
find_package(imgui CONFIG REQUIRED)

# Find glslc shader compiler
find_program(GLSLC glslc HINTS Vulkan::glslc)

function(compile_shader TARGET SHADER)
    get_filename_component(SHADER_NAME ${SHADER} NAME)
    set(SPIRV "${CMAKE_CURRENT_BINARY_DIR}/shaders/${SHADER_NAME}.spv")
    add_custom_command(
            OUTPUT ${SPIRV}
            COMMAND ${CMAKE_COMMAND} -E make_directory "${CMAKE_CURRENT_BINARY_DIR}/shaders/"
            COMMAND ${GLSLC} -o ${SPIRV} ${SHADER}
            DEPENDS ${SHADER}
            COMMENT "Compiling ${SHADER_NAME}"
    )
    target_sources(${TARGET} PRIVATE ${SPIRV})
endfunction()

add_executable(HelloWorld helloworld.cpp
        vmaimpl.cpp)

# Compile shaders
file(GLOB_RECURSE SHADERS
        "${CMAKE_CURRENT_SOURCE_DIR}/shaders/*.vert"
        "${CMAKE_CURRENT_SOURCE_DIR}/shaders/*.frag"
)
foreach(SHADER ${SHADERS})
    compile_shader(HelloWorld ${SHADER})
endforeach()

# Copy compiled shaders to the build directory
add_custom_command(TARGET HelloWorld POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/shaders"
        "$<TARGET_FILE_DIR:HelloWorld>/shaders"
)

target_link_libraries(HelloWorld PRIVATE fmt::fmt vk-bootstrap::vk-bootstrap)
target_link_libraries(HelloWorld PRIVATE Vulkan::Vulkan)
target_link_libraries(HelloWorld PRIVATE glfw)
target_link_libraries(HelloWorld PRIVATE GPUOpen::VulkanMemoryAllocator)
target_link_libraries(HelloWorld PRIVATE imgui::imgui)
