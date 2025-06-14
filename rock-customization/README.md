# Interactive 3D Rock Model

A photorealistic and interactive 3D rock model built with Three.js that you can rotate, zoom, and customize in real-time.

## Features

- **Photorealistic Rendering**: Uses PBR (Physically Based Rendering) materials with procedural textures
- **Interactive Controls**: Mouse controls for rotation, zoom, and panning
- **Real-time Customization**: Adjust surface roughness, metalness, and lighting
- **Procedural Generation**: Generate unique rock variations with the randomize feature
- **Atmospheric Effects**: Floating particles and multiple light sources for realism

## Controls

### Mouse Controls
- **Left Click + Drag**: Rotate the rock
- **Right Click + Drag**: Pan the view
- **Scroll Wheel**: Zoom in/out

### UI Controls
- **Surface Roughness**: Adjust how rough or smooth the rock surface appears
- **Metalness**: Control metallic properties of the rock
- **Surface Detail**: Modify the displacement mapping intensity
- **Light Intensity**: Adjust the main lighting brightness
- **Randomize Rock**: Generate a new random rock shape and color
- **Reset View**: Return camera to default position

## Technical Details

- Built with Three.js WebGL library
- Uses procedural noise generation for realistic rock surfaces
- Implements PBR materials with custom normal maps and textures
- Features multiple light sources (directional, ambient, fill, and rim lighting)
- Includes shadow mapping and tone mapping for enhanced realism

## Running the Application

Simply open `index.html` in a modern web browser. No installation or build process required!

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

Requires WebGL support for 3D rendering.
