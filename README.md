# Rise of Color

## About the Project

Rise of Color visualizes the historical emergence of colors in photography, showing when new colors appeared and how the overall color palette expanded through the decades. The visualization arranges colors in a 3D color space based on hue, saturation, and lightness, creating a spherical representation of the complete color spectrum.

## Data Source
Historical images from [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons)

## How the 3D Visualization Works

### Color Space Structure

The visualization organizes colors in a 3D spherical space:

1. **Position Mapping**:
   - **Hue**: Mapped to the angle around the sphere (longitude)
   - **Lightness**: Mapped to the vertical position (latitude)
   - **Saturation**: Mapped to the distance from the center axis

2. **Special Handling**:
   - **Grayscale Colors**: Placed along the central vertical axis
   - **Bright Colors**: Positioned toward the top of the sphere
   - **Dark Colors**: Positioned toward the bottom of the sphere
   - **Vivid Colors**: Positioned farther from the center
   - **Muted Colors**: Positioned closer to the center

### Technical Implementation

The visualization is built using modern web technologies:

1. **Rendering Engine**: Three.js for WebGL-based 3D graphics

### Visualization Construction

The entire 3D structure is built incrementally from thousands of individual spheres:

1. **Individual Color Representation**:
   - Each small sphere represents a unique color that appeared in photographs from a specific year
   - Once a color appears, it remains in the visualization permanently
   - The visualization only adds new colors that haven't been seen before

2. **Sphere Positioning Logic**:
   - **Spherical Coordinates**: Each color is converted from RGB to HSL (Hue, Saturation, Lightness)
   - **Angle (θ)**: The hue value (0-360°) determines the angle around the central axis
   - **Height (y)**: Calculated from lightness - brighter colors appear higher
   - **Distance from Axis (r)**: Determined by saturation - more saturated colors appear farther from center
   - **Grayscale Colors**: These have special placement along the vertical axis with small random angles

3. **Chronological Construction**:
   - The visualization begins empty and adds colors year by year
   - As each year progresses, newly discovered colors appear as spheres in their calculated positions
   - Earlier years contribute fewer colors, while later years (especially after the introduction of color photography) contribute many more

### Color Clustering Visualization

In addition to showing individual color points, the visualization includes a powerful clustering feature that reveals dominant color patterns over time:

1. **Clustering Mode**:
   - Toggle between "Show All Colors" and "Show Clusters" using the button in the control panel
   - When clustering is enabled, individual color points fade and cluster spheres become visible
   - Each cluster represents a group of similar colors, with the sphere positioned at the average color

2. **K-means Clustering Algorithm**:
   - The visualization uses K-means clustering to group similar colors based on their RGB values
   - Multiple cluster resolutions are available through the dropdown menu (4, 8, 16, 32 or 64 clusters)