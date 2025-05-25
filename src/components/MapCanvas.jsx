import React, { useRef, useEffect } from 'react';
import SimplexNoise from 'simplex-noise';

const MapCanvas = ({ oceanLevel, mountainDensity, forestCoverage }) => {
  const canvasRef = useRef(null);
  const canvasWidth = 800;
  const canvasHeight = 600;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const simplex = new SimplexNoise(); // You can pass a seed here if desired

    const landScale = 100;
    const mountainScale = 50;
    const forestScale = 75; // Scale for forest noise
    const forestNoiseOffset = 10000; // Offset to differentiate forest noise

    const waterColor = '#4682B4'; // SteelBlue
    const landColor = '#556B2F'; // DarkOliveGreen
    const mountainColor = '#808080'; // Gray
    const forestColor = '#228B22'; // ForestGreen

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const landNoiseValue = simplex.noise2D(x / landScale, y / landScale);
        let finalColor = waterColor; // Default to water

        if (landNoiseValue > oceanLevel) {
          // It's land
          finalColor = landColor; // Base land color

          const mountainNoiseValue = simplex.noise2D(x / mountainScale, y / mountainScale);
          const mountainThreshold = 1 - mountainDensity;

          if (mountainNoiseValue > mountainThreshold) {
            finalColor = mountainColor; // It's a mountain
          } else {
            // Not a mountain, check for forest
            const forestNoiseValue = simplex.noise2D(
              x / forestScale + forestNoiseOffset,
              y / forestScale + forestNoiseOffset
            );
            const forestThreshold = 1 - forestCoverage;

            if (forestNoiseValue > forestThreshold) {
              finalColor = forestColor; // It's a forest
            }
          }
        }
        ctx.fillStyle = finalColor;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [oceanLevel, mountainDensity, forestCoverage]); // Redraw when any of these change

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="border border-gray-500"
    />
  );
};

export default MapCanvas;
