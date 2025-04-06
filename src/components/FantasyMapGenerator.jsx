import React, { useState, useEffect, useRef } from 'react';
import { Download, RefreshCcw, Sun, Moon } from 'lucide-react';
import './FantasyMapGenerator.css';

const FantasyMapGenerator = () => {
  const canvasRef = useRef(null);
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000));
  const [mapStyle, setMapStyle] = useState('parchment');
  const [mapSize, setMapSize] = useState({ width: 800, height: 600 });
  const [featureSettings, setFeatureSettings] = useState({
    mountainDensity: 0.5,
    forestDensity: 0.6,
    riverCount: 5,
    cityCount: 7,
    includeRoads: true,
    includeLabels: true,
    oceanDepth: 0.65
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // --- Perlin Noise Function (Improved Implementation) ---
  const generateNoise = (width, height, inputSeed, scale = 20, octaves = 6, persistence = 0.5, lacunarity = 2) => {
    const noise = new Array(width * height).fill(0);
    let currentSeed = inputSeed;

    // Simple Pseudo-Random Number Generator (PRNG) based on the seed
    const random = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      const rnd = currentSeed / 233280.0;
      return rnd;
    };

    // Generate gradient vectors using the seeded PRNG
    const gradients = [];
    for (let i = 0; i < 256; i++) {
      const angle = random() * Math.PI * 2;
      gradients.push([Math.cos(angle), Math.sin(angle)]);
    }

    // Permutation table using the seeded PRNG
    const p = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]]; // Shuffle
    }
    const perm = [...p, ...p]; // Double the permutation table to avoid index wrapping issues

    // Fade function (improves visual quality)
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

    // Linear interpolation
    const lerp = (t, a, b) => a + t * (b - a);

    // Calculate gradient dot product
    const grad = (hash, x, y) => {
      const g = gradients[hash % 256]; // Use seeded gradients
      return g[0] * x + g[1] * y;
    };

    // Generate Perlin noise
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let amplitude = 1;
        let frequency = 1;
        let noiseValue = 0;
        let maxAmplitude = 0; // For normalization

        for (let o = 0; o < octaves; o++) {
          const sampleX = x / scale * frequency;
          const sampleY = y / scale * frequency;

          const X = Math.floor(sampleX) & 255;
          const Y = Math.floor(sampleY) & 255;

          const xf = sampleX - Math.floor(sampleX);
          const yf = sampleY - Math.floor(sampleY);

          const u = fade(xf);
          const v = fade(yf);

          // Hash coordinates of the 4 corners
          const aa = perm[X] + Y;
          const ab = perm[X] + Y + 1;
          const ba = perm[X + 1] + Y;
          const bb = perm[X + 1] + Y + 1;

          // Calculate dot products and interpolate
          const noiseAtPoint = lerp(v, lerp(u, grad(perm[aa], xf, yf), grad(perm[ba], xf - 1, yf)),
                                    lerp(u, grad(perm[ab], xf, yf - 1), grad(perm[bb], xf - 1, yf - 1)));

          noiseValue += noiseAtPoint * amplitude;
          maxAmplitude += amplitude;
          amplitude *= persistence;
          frequency *= lacunarity;
        }

        // Store the normalized noise value
        noise[y * width + x] = (noiseValue / maxAmplitude + 1) / 2; // Normalize to [0, 1] range
      }
    }
    return noise;
  };

  // --- Terrain Generation ---
  const generateTerrain = (ctx, width, height, currentSeed) => {
    setIsGenerating(true); // Indicate generation started
    console.time('generateTerrain');

    // Generate base terrain and detail noise using the current seed
    const terrainNoise = generateNoise(width, height, currentSeed, 100, 8, 0.5, 2);
    const detailNoise = generateNoise(width, height, currentSeed + 1, 50, 6, 0.6, 2.2); // Use a different seed offset for detail

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    const { oceanDepth } = featureSettings;

    // Color definitions based on style
    let deepOcean, ocean, shallowWater, sand, grass, forestTerrain, mountain, snowPeak;

    if (mapStyle === 'color') {
      deepOcean = [10, 30, 70, 255];
      ocean = [65, 105, 170, 255];
      shallowWater = [100, 142, 190, 255];
      sand = [238, 214, 175, 255];
      grass = [124, 184, 104, 255]; // Brighter green
      forestTerrain = [80, 140, 80, 255]; // Darker green for forest base
      mountain = [150, 142, 134, 255]; // Slightly browner mountains
      snowPeak = [245, 245, 245, 255];
    } else { // Parchment style (subdued colors)
      deepOcean = [180, 170, 140, 255]; // Darker parchment water
      ocean = [200, 190, 160, 255];
      shallowWater = [210, 200, 170, 255];
      sand = [225, 210, 180, 255]; // Parchment sand
      grass = [205, 195, 170, 255]; // Light greenish-brown
      forestTerrain = [190, 185, 160, 255]; // Slightly darker/greener
      mountain = [170, 165, 155, 255]; // Greyish-brown
      snowPeak = [230, 230, 225, 255]; // Off-white
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x);
        const idx = i * 4;
        const noiseValue = terrainNoise[i];
        const detailValue = detailNoise[i];

        let color;
        if (noiseValue < oceanDepth - 0.15) { color = deepOcean; }
        else if (noiseValue < oceanDepth - 0.05) { color = ocean; }
        else if (noiseValue < oceanDepth) { color = shallowWater; }
        else if (noiseValue < oceanDepth + 0.03) { color = sand; }
        else if (noiseValue < oceanDepth + 0.3) { color = grass; }
        else if (noiseValue < oceanDepth + 0.45) { color = forestTerrain; } // Use forest base color
        else if (noiseValue < oceanDepth + 0.6) { color = mountain; }
        else { color = snowPeak; }

        // Apply detail noise for slightly more natural color variation
        const detailInfluence = mapStyle === 'color' ? 0.1 : 0.05; // Less influence on parchment
        data[idx] = Math.min(255, Math.max(0, color[0] + (detailValue - 0.5) * detailInfluence * 50));
        data[idx + 1] = Math.min(255, Math.max(0, color[1] + (detailValue - 0.5) * detailInfluence * 50));
        data[idx + 2] = Math.min(255, Math.max(0, color[2] + (detailValue - 0.5) * detailInfluence * 50));
        data[idx + 3] = color[3];
      }
    }

    ctx.putImageData(imageData, 0, 0);
    console.timeEnd('generateTerrain');
    return terrainNoise; // Return noise for other features
  };

  // Generate map functionality
  const generateMap = () => {
    console.log(`Generating map with seed: ${seed}, style: ${mapStyle}`);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = mapSize;

    // Ensure canvas dimensions are set
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = mapStyle === 'parchment' ? '#E3D9BB' : '#4169E1';
    ctx.fillRect(0, 0, width, height);

    // We'll now import the full functionality from main.js
    // First, we need to implement the functions...

    // Show a simplified terrain generation for now
    setIsGenerating(true);
    
    // Generate base terrain and detail noise
    const terrainNoise = generateNoise(width, height, seed, 100, 8, 0.5, 2);
    const detailNoise = generateNoise(width, height, seed + 1, 50, 6, 0.6, 2.2);

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    const { oceanDepth } = featureSettings;

    // Color definitions based on style
    let deepOcean, ocean, shallowWater, sand, grass, forestTerrain, mountain, snowPeak;

    if (mapStyle === 'color') {
      deepOcean = [10, 30, 70, 255];
      ocean = [65, 105, 170, 255];
      shallowWater = [100, 142, 190, 255];
      sand = [238, 214, 175, 255];
      grass = [124, 184, 104, 255];
      forestTerrain = [80, 140, 80, 255]; 
      mountain = [150, 142, 134, 255];
      snowPeak = [245, 245, 245, 255];
    } else { // Parchment style
      deepOcean = [180, 170, 140, 255];
      ocean = [200, 190, 160, 255];
      shallowWater = [210, 200, 170, 255];
      sand = [225, 210, 180, 255];
      grass = [205, 195, 170, 255];
      forestTerrain = [190, 185, 160, 255];
      mountain = [170, 165, 155, 255];
      snowPeak = [230, 230, 225, 255];
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x);
        const idx = i * 4;
        const noiseValue = terrainNoise[i];
        const detailValue = detailNoise[i];

        let color;
        if (noiseValue < oceanDepth - 0.15) { color = deepOcean; }
        else if (noiseValue < oceanDepth - 0.05) { color = ocean; }
        else if (noiseValue < oceanDepth) { color = shallowWater; }
        else if (noiseValue < oceanDepth + 0.03) { color = sand; }
        else if (noiseValue < oceanDepth + 0.3) { color = grass; }
        else if (noiseValue < oceanDepth + 0.45) { color = forestTerrain; }
        else if (noiseValue < oceanDepth + 0.6) { color = mountain; }
        else { color = snowPeak; }

        // Apply detail noise for slightly more natural color variation
        const detailInfluence = mapStyle === 'color' ? 0.1 : 0.05;
        data[idx] = Math.min(255, Math.max(0, color[0] + (detailValue - 0.5) * detailInfluence * 50));
        data[idx + 1] = Math.min(255, Math.max(0, color[1] + (detailValue - 0.5) * detailInfluence * 50));
        data[idx + 2] = Math.min(255, Math.max(0, color[2] + (detailValue - 0.5) * detailInfluence * 50));
        data[idx + 3] = color[3];
      }
    }

    ctx.putImageData(imageData, 0, 0);
    
    // Generate mountains
    const generateMountains = () => {
      const { mountainDensity, oceanDepth } = featureSettings;
      // Use seed for ridge noise generation
      const mountainRidgeNoise = generateNoise(width, height, seed + 2, 150, 4, 0.6, 2.1);
      const mountainDetailNoise = generateNoise(width, height, seed + 3, 30, 5, 0.5, 2.0);

      ctx.fillStyle = mapStyle === 'color' ? 'rgba(100, 90, 80, 0.5)' : 'rgba(80, 75, 70, 0.4)';
      ctx.strokeStyle = mapStyle === 'color' ? 'rgba(200, 200, 195, 0.6)' : 'rgba(210, 210, 205, 0.5)';
      ctx.lineWidth = 0.5;

      for (let y = 0; y < height; y += 3) {
          for (let x = 0; x < width; x += 3) {
              const i = y * width + x;
              if (!terrainNoise[i]) continue;

              const terrainValue = terrainNoise[i];
              const ridgeValue = mountainRidgeNoise[i];
              const detailValue = mountainDetailNoise[i];

              if (terrainValue > oceanDepth + 0.4 && ridgeValue > (0.8 - mountainDensity * 0.4) && terrainValue < 0.95) {
                  const baseSize = 3 + Math.floor((terrainValue - (oceanDepth + 0.4)) * 25);
                  const peakHeight = baseSize * (1.5 + detailValue * 1.5);
                  const angle = detailValue * Math.PI * 2;

                  ctx.beginPath();
                  ctx.moveTo(x, y);
                  ctx.lineTo(x + baseSize * 0.6 * Math.cos(angle - 0.5), y - peakHeight * Math.sin(angle - 0.5));
                  ctx.lineTo(x - baseSize * 0.6 * Math.cos(angle + 0.5), y - peakHeight * Math.sin(angle + 0.5));
                  ctx.closePath();

                  ctx.fillStyle = mapStyle === 'color' ? 
                    `rgba(${100 + detailValue * 20}, ${90 + detailValue * 20}, ${80 + detailValue * 20}, 0.6)` : 
                    `rgba(80, 75, 70, ${0.3 + detailValue * 0.3})`;
                  ctx.fill();

                  // Add highlight
                  ctx.beginPath();
                  ctx.moveTo(x, y);
                  ctx.lineTo(x + baseSize * 0.3 * Math.cos(angle - 0.5), y - peakHeight * 0.8 * Math.sin(angle - 0.5));
                  ctx.stroke();

                  // Add snow caps
                  if (terrainValue > oceanDepth + 0.55 + detailValue * 0.1) {
                      ctx.fillStyle = mapStyle === 'color' ? 'rgba(245, 245, 245, 0.8)' : 'rgba(230, 230, 225, 0.7)';
                      const snowSize = Math.max(1, baseSize * (terrainValue - (oceanDepth + 0.55)) * 5);
                      ctx.beginPath();
                      ctx.arc(x, y - peakHeight * 0.7, snowSize, 0, Math.PI * 2);
                      ctx.fill();
                  }
              }
          }
      }
    };

    // Generate forests
    const generateForests = () => {
      const { forestDensity, oceanDepth } = featureSettings;
      const forestNoise = generateNoise(width, height, seed + 4, 60, 5, 0.55, 2.1);
      const treeDetailNoise = generateNoise(width, height, seed + 5, 15, 4, 0.6, 2.0);

      const treeColor = mapStyle === 'color' ? '#3A613A' : '#6A785A';

      for (let y = 5; y < height - 5; y += 4) {
          for (let x = 5; x < width - 5; x += 4) {
              const i = y * width + x;
              if (!terrainNoise[i]) continue;

              const terrainValue = terrainNoise[i];
              const forestValue = forestNoise[i];
              const treeDetail = treeDetailNoise[i];

              if (terrainValue > oceanDepth + 0.04 && 
                  terrainValue < oceanDepth + 0.45 && 
                  forestValue > (0.65 - forestDensity * 0.3)) {

                  const clumpSize = 2 + Math.floor(forestValue * 5);
                  const numTrees = 2 + Math.floor(treeDetail * 4);

                  for(let t = 0; t < numTrees; t++) {
                      const offsetX = (Math.random() - 0.5) * clumpSize * 1.5;
                      const offsetY = (Math.random() - 0.5) * clumpSize * 1.5;
                      const treeSize = 1.5 + Math.random() * 2.5;

                      ctx.fillStyle = treeColor;
                      ctx.beginPath();
                      
                      if (mapStyle === 'parchment') {
                          ctx.arc(x + offsetX, y + offsetY, treeSize, 0, Math.PI * 2);
                      } else {
                          ctx.moveTo(x + offsetX, y + offsetY - treeSize);
                          ctx.lineTo(x + offsetX - treeSize / 1.5, y + offsetY + treeSize / 2);
                          ctx.lineTo(x + offsetX + treeSize / 1.5, y + offsetY + treeSize / 2);
                          ctx.closePath();
                      }

                      ctx.fill();
                  }
              }
          }
      }
    };
    
    // Generate cities
    const generateCities = () => {
      const { cityCount, oceanDepth } = featureSettings;
      const cities = [];
      const minCityDistance = 40; // Minimum distance between cities

      // Use seeded PRNG for city placement attempts
      let citySeed = seed + 7;
      const randomCityPoint = () => {
          citySeed = (citySeed * 9301 + 49297) % 233280;
          return citySeed / 233280.0;
      };

      let attempts = 0;
      const maxAttempts = cityCount * 20; // Try more times to find good spots

      while (cities.length < cityCount && attempts < maxAttempts) {
          const x = Math.floor(randomCityPoint() * (width - 60)) + 30; // Avoid map edges
          const y = Math.floor(randomCityPoint() * (height - 60)) + 30;
          const terrainIndex = y * width + x;

          if (terrainNoise[terrainIndex]) {
              const terrainValue = terrainNoise[terrainIndex];

              if (terrainValue > oceanDepth + 0.02 && terrainValue < oceanDepth + 0.5) {
                  let tooClose = false;
                  for (const existingCity of cities) {
                      const dx = x - existingCity.x;
                      const dy = y - existingCity.y;
                      if (Math.sqrt(dx * dx + dy * dy) < minCityDistance) {
                          tooClose = true;
                          break;
                      }
                  }

                  if (!tooClose) {
                      cities.push({ x, y, size: randomCityPoint() * 0.6 + 0.5 }); // Random size, lean towards larger
                  }
              }
          }
          attempts++;
      }

      // Draw cities
      const cityColor = mapStyle === 'color' ? '#A0522D' : '#8B4513'; // Sienna / SaddleBrown
      const cityOutline = mapStyle === 'color' ? '#402510' : '#301A0A';
      const cityCenterColor = mapStyle === 'color' ? '#D2B48C' : '#C1A87C'; // Tan / Darker Tan

      cities.forEach(city => {
          const baseSize = 4 + Math.floor(city.size * 5); // Base radius

          // Simple city representation: outer circle, inner detail
          ctx.fillStyle = cityColor;
          ctx.strokeStyle = cityOutline;
          ctx.lineWidth = 1;

          ctx.beginPath();
          ctx.arc(city.x, city.y, baseSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Inner detail (optional)
          ctx.fillStyle = cityCenterColor;
          ctx.beginPath();
          ctx.arc(city.x, city.y, baseSize * 0.5, 0, Math.PI * 2);
          ctx.fill();
      });

      // If roads are enabled, generate roads between cities
      if (featureSettings.includeRoads && cities.length >= 2) {
        const roadColor = mapStyle === 'color' ? '#B8860B' : '#A0522D'; // DarkGoldenrod / Sienna
        ctx.strokeStyle = roadColor;
        ctx.lineWidth = mapStyle === 'color' ? 1.2 : 1.0; // Thinner on parchment
        ctx.setLineDash([2, 2]); // Dashed line for roads

        // Use a simple MST-like algorithm to connect cities
        const connected = new Set();
        const edges = [];

        // Calculate all possible edges and distances
        for (let i = 0; i < cities.length; i++) {
            for (let j = i + 1; j < cities.length; j++) {
                const dx = cities[i].x - cities[j].x;
                const dy = cities[i].y - cities[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                edges.push({ u: i, v: j, dist });
            }
        }

        // Sort edges by distance
        edges.sort((a, b) => a.dist - b.dist);

        const parent = Array(cities.length).fill(0).map((_, i) => i);
        const find = (i) => {
            if (parent[i] === i) return i;
            return parent[i] = find(parent[i]);
        };
        const union = (i, j) => {
            const rootI = find(i);
            const rootJ = find(j);
            if (rootI !== rootJ) {
                parent[rootI] = rootJ;
                return true;
            }
            return false;
        };

        let edgeCount = 0;
        for (const edge of edges) {
            if (union(edge.u, edge.v)) {
                const city1 = cities[edge.u];
                const city2 = cities[edge.v];

                // Add a simple curved road
                ctx.beginPath();
                ctx.moveTo(city1.x, city1.y);

                // Add slight curve for visual interest
                const midX = (city1.x + city2.x) / 2;
                const midY = (city1.y + city2.y) / 2;
                const dx = city2.x - city1.x;
                const dy = city2.y - city1.y;
                const perpX = -dy * 0.15; // Control point offset perpendicular to the line
                const perpY = dx * 0.15;
                const ctrlX = midX + perpX * (Math.random() - 0.5) * 2;
                const ctrlY = midY + perpY * (Math.random() - 0.5) * 2;

                ctx.quadraticCurveTo(ctrlX, ctrlY, city2.x, city2.y);
                ctx.stroke();

                edgeCount++;
            }
        }

        ctx.setLineDash([]); // Reset line dash
      }

      // Add city labels if enabled
      if (featureSettings.includeLabels) {
        // City name generation (simplified)
        const cityNamePrefixes = ["Silver", "Iron", "Storm", "Moon", "Shadow", "Gold", "River", "Oak", "Dragon", "Frost"];
        const cityNameSuffixes = ["haven", "wood", "cliff", "bright", "fen", "crest", "bend", "spire", "ford", "stone"];
        
        let nameSeed = seed + 8;
        const randomNamePart = (arr) => {
          nameSeed = (nameSeed * 9301 + 49297) % 233280;
          return arr[Math.floor((nameSeed / 233280.0) * arr.length)];
        };
        
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const labelColor = mapStyle === 'color' ? "#1A1A1A" : "#4A3A2A"; // Dark grey / Dark brown
        const outlineColor = mapStyle === 'color' ? "rgba(255, 255, 255, 0.7)" : "rgba(235, 225, 200, 0.6)";
        
        ctx.font = mapStyle === 'color' ? "bold 11px sans-serif" : "bold 11px serif";
        
        const usedNames = new Set();
        
        cities.forEach((city) => {
          const prefix = randomNamePart(cityNamePrefixes);
          const suffix = randomNamePart(cityNameSuffixes);
          const name = prefix + suffix;
          
          if (!usedNames.has(name)) {
            usedNames.add(name);
            
            const textX = city.x;
            const textY = city.y + 14; // Place below city marker
            
            // Draw outline for better readability
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 2.5;
            ctx.strokeText(name, textX, textY);
            
            // Draw main text
            ctx.fillStyle = labelColor;
            ctx.fillText(name, textX, textY);
          }
        });
      }

      return cities;
    };

    // Generate rivers
    const generateRivers = () => {
      const { riverCount, oceanDepth } = featureSettings;
      const riverColor = mapStyle === 'color' ? 'rgba(65, 105, 170, 0.9)' : 'rgba(150, 140, 110, 0.8)';
      ctx.strokeStyle = riverColor;

      // Simple PRNG for river starting points, seeded
      let riverSeed = seed + 6;
      const randomRiverPoint = () => {
          riverSeed = (riverSeed * 9301 + 49297) % 233280;
          return riverSeed / 233280.0;
      };

      for (let r = 0; r < riverCount; r++) {
          let startX, startY;
          let attempts = 0;
          let foundStart = false;

          // Try to find a suitable high-ground starting point inland
          while (attempts < 200 && !foundStart) {
              startX = Math.floor(randomRiverPoint() * (width * 0.8)) + width * 0.1;
              startY = Math.floor(randomRiverPoint() * (height * 0.8)) + height * 0.1;
              const startIndex = Math.floor(startY) * width + Math.floor(startX);

              if (terrainNoise[startIndex] && terrainNoise[startIndex] > oceanDepth + 0.3 && terrainNoise[startIndex] < oceanDepth + 0.55) {
                  foundStart = true;
              }
              attempts++;
          }

          if (!foundStart) continue; // Didn't find a good spot for this river

          ctx.beginPath();
          ctx.moveTo(startX, startY);

          let x = startX;
          let y = startY;
          let currentHeight = terrainNoise[Math.floor(y) * width + Math.floor(x)];
          let steps = 0;
          const maxSteps = 1500;
          let path = [{x, y}];

          // River width increases as it flows
          let currentLineWidth = 0.5 + Math.random() * 1.5;
          ctx.lineWidth = currentLineWidth;

          while (currentHeight > oceanDepth && steps < maxSteps) {
              let lowestHeight = currentHeight;
              let nextX = x;
              let nextY = y;
              let foundNextStep = false;

              // Check 8 neighbours + diagonals for the steepest downhill path
              const neighbors = [];
              for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                      if (dx === 0 && dy === 0) continue;

                      const nx = Math.round(x + dx);
                      const ny = Math.round(y + dy);

                      // Bounds check
                      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                          const neighborIndex = ny * width + nx;
                          if (terrainNoise[neighborIndex] !== undefined) {
                              // Avoid stepping directly back onto the last point
                              if(path.length > 1 && path[path.length-2].x === nx && path[path.length-2].y === ny) continue;

                              neighbors.push({ x: nx, y: ny, height: terrainNoise[neighborIndex] });
                          }
                      }
                  }
              }

              // Sort neighbors by height (lowest first)
              neighbors.sort((a, b) => a.height - b.height);

              // Try to move to the lowest valid neighbor that isn't backtracking
              for(const neighbor of neighbors) {
                  if (neighbor.height < currentHeight) { // Must go downhill
                      nextX = neighbor.x;
                      nextY = neighbor.y;
                      lowestHeight = neighbor.height;
                      foundNextStep = true;
                      break; // Take the first valid downhill step
                  }
              }

              if (!foundNextStep) {
                  break; // End river if no downhill path found
              }

              // Update position and draw line segment
              x = nextX;
              y = nextY;
              path.push({x, y});
              currentHeight = lowestHeight;

              // Increase line width slightly as river progresses
              if(steps % 50 === 0 && currentLineWidth < 4) {
                  currentLineWidth += 0.2;
                  ctx.lineWidth = currentLineWidth;
                  ctx.stroke(); // Stroke the current path segment
                  ctx.beginPath(); // Start new segment for new width
                  ctx.moveTo(x, y); // Move to current point
              } else {
                  ctx.lineTo(x, y);
              }

              steps++;
          }

          ctx.stroke(); // Stroke the final segment
      }
    };
    
    // Apply post-processing
    const applyPostprocessing = () => {
      if (mapStyle === 'parchment') {
        // Parchment Color Overlay
        ctx.fillStyle = 'rgba(227, 217, 187, 0.25)'; // Semi-transparent parchment color
        ctx.fillRect(0, 0, width, height);

        // Darker Border
        ctx.strokeStyle = '#7A6A5A'; // Darker, less saturated brown
        ctx.lineWidth = 12;
        ctx.strokeRect(6, 6, width - 12, height - 12); // Inset border

        // Inner vignette/edge darkening
        const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)'); // Subtle darkening towards edges
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      } else if (mapStyle === 'color') {
        // Simple border for color maps
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, width - 4, height - 4);
      }
    };
    
    // Generate all map features in the correct order
    generateMountains();
    generateForests();
    generateRivers();
    generateCities();
    
    // Apply final post-processing
    applyPostprocessing();
    
    setIsGenerating(false);
  };

  // Event handlers
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `fantasy-map-${mapStyle}-${seed}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegenerateMap = () => {
    setSeed(Math.floor(Math.random() * 1000000));
  };

  const handleUpdateSetting = (setting, value) => {
    const numericSettings = ['mountainDensity', 'forestDensity', 'riverCount', 'cityCount', 'oceanDepth'];
    const processedValue = numericSettings.includes(setting) ? Number(value) : value;

    setFeatureSettings(prev => ({
      ...prev,
      [setting]: processedValue
    }));
  };

  const handleChangeMapStyle = (style) => {
    setMapStyle(style);
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // Apply dark mode to document body
    if (!darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  // Apply initial dark mode state
  useEffect(() => {
    // Check for user preference
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      setDarkMode(true);
      document.body.classList.add('dark-mode');
    }
  }, []);

  // Generate map when seed, style, or settings change
  useEffect(() => {
    generateMap();
  }, [seed, mapStyle, featureSettings, mapSize]);

  return (
    <div className={`flex flex-col items-center p-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} min-h-screen transition-colors duration-300`}>
      {/* Theme Toggle Button */}
      <button 
        onClick={toggleDarkMode}
        className={`absolute top-4 right-4 p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-200' : 'bg-blue-100 text-blue-800'} transition-colors duration-300`}
        aria-label="Toggle dark mode"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      
      {/* Enhanced Title Section */}
      <div className="text-center mb-8 mt-4">
        <h1 className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-2 transition-colors duration-300`}>
          Fantasy Map Generator
        </h1>
        <div className="w-40 h-1 bg-gradient-to-r from-blue-500 via-teal-500 to-green-500 mx-auto mb-2"></div>
        <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} transition-colors duration-300`}>
          Create unique, detailed fantasy worlds
        </p>
      </div>

      {/* Controls Section */}
      <div className={`w-full max-w-5xl ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'} p-6 rounded-lg shadow-md mb-6 flex flex-wrap gap-8 justify-between items-start transition-colors duration-300`}>
        {/* Left Side Controls: Generation & Style */}
        <div className="flex flex-col gap-4 w-full md:w-auto mb-4 md:mb-0">
          {/* Seed & Regenerate */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleRegenerateMap}
              className={`py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200 flex items-center gap-2 disabled:opacity-50 shadow-sm`}
              title="Generate New Map (Random Seed)"
              disabled={isGenerating}
            >
              <RefreshCcw size={18} />
              Regenerate
            </button>
            <span className={`text-sm font-medium ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'} py-1 px-3 rounded-md transition-colors duration-300`}>
              Seed: {seed}
            </span>
          </div>

          {/* Map Style */}
          <div className="flex flex-col">
            <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2 transition-colors duration-300`}>Map Style:</label>
            <div className="flex gap-3">
              <button
                onClick={() => handleChangeMapStyle('parchment')}
                className={`px-4 py-2 text-sm rounded-md shadow-sm ${
                  mapStyle === 'parchment' 
                    ? 'bg-amber-600 text-white' 
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } transition duration-200`}
                disabled={isGenerating}
              >
                Parchment
              </button>
              <button
                onClick={() => handleChangeMapStyle('color')}
                className={`px-4 py-2 text-sm rounded-md shadow-sm ${
                  mapStyle === 'color' 
                    ? 'bg-teal-600 text-white' 
                    : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } transition duration-200`}
                disabled={isGenerating}
              >
                Color
              </button>
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-200 flex items-center gap-2 disabled:opacity-50 shadow-sm mt-2"
            disabled={isGenerating}
            title="Download Map as PNG"
          >
            <Download size={18} />
            Download Map
          </button>
        </div>

        {/* Right Side Controls: Feature Settings */}
        <div className="flex flex-col gap-4 flex-grow w-full md:w-auto" style={{minWidth: '300px', maxWidth: '100%'}}>
          <h2 className={`text-lg font-semibold ${darkMode ? 'text-gray-200 border-gray-600' : 'text-gray-700 border-gray-200'} mb-1 border-b pb-2 transition-colors duration-300`}>
            Map Features
          </h2>

          {/* Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <label htmlFor="oceanDepth" className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} self-center transition-colors duration-300`}>Ocean Level:</label>
            <div className="w-full flex flex-col">
              <input type="range" id="oceanDepth" name="oceanDepth" min="0.3" max="0.8" step="0.01"
                    value={featureSettings.oceanDepth}
                    onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                    className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
                    disabled={isGenerating} />
              <div className="w-full flex justify-between text-xs text-gray-500 mt-1">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            <label htmlFor="mountainDensity" className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} self-center transition-colors duration-300`}>Mountains:</label>
            <div className="w-full flex flex-col">
              <input type="range" id="mountainDensity" name="mountainDensity" min="0" max="1" step="0.05"
                    value={featureSettings.mountainDensity}
                    onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                    className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-stone-300"
                    disabled={isGenerating} />
              <div className="w-full flex justify-between text-xs text-gray-500 mt-1">
                <span>Few</span>
                <span>Many</span>
              </div>
            </div>

            <label htmlFor="forestDensity" className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} self-center transition-colors duration-300`}>Forests:</label>
            <div className="w-full flex flex-col">
              <input type="range" id="forestDensity" name="forestDensity" min="0" max="1" step="0.05"
                    value={featureSettings.forestDensity}
                    onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                    className="w-full h-2 bg-green-100 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-300"
                    disabled={isGenerating} />
              <div className="w-full flex justify-between text-xs text-gray-500 mt-1">
                <span>Sparse</span>
                <span>Dense</span>
              </div>
            </div>

            <label htmlFor="riverCount" className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} self-center transition-colors duration-300`}>Rivers:</label>
            <div className="w-full flex flex-col">
              <input type="range" id="riverCount" name="riverCount" min="0" max="15" step="1"
                    value={featureSettings.riverCount}
                    onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                    className="w-full h-2 bg-sky-100 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-300"
                    disabled={isGenerating} />
              <div className="w-full flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>15</span>
              </div>
            </div>

            <label htmlFor="cityCount" className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} self-center transition-colors duration-300`}>Cities:</label>
            <div className="w-full flex flex-col">
              <input type="range" id="cityCount" name="cityCount" min="0" max="20" step="1"
                    value={featureSettings.cityCount}
                    onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                    className="w-full h-2 bg-amber-100 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-300"
                    disabled={isGenerating} />
              <div className="w-full flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>20</span>
              </div>
            </div>
          </div>

          {/* Checkboxes - more responsive layout */}
          <div className={`flex gap-6 mt-2 border-t ${darkMode ? 'border-gray-600' : 'border-gray-200'} pt-3 flex-wrap transition-colors duration-300`}>
            <label className={`flex items-center gap-2 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} cursor-pointer transition-colors duration-300`}>
              <input type="checkbox" name="includeLabels"
                    checked={featureSettings.includeLabels}
                    onChange={(e) => handleUpdateSetting(e.target.name, e.target.checked)}
                    className={`w-4 h-4 rounded ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'} text-blue-600 focus:ring-blue-500 transition-colors duration-300`}
                    disabled={isGenerating} />
              City Labels
            </label>
            <label className={`flex items-center gap-2 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} cursor-pointer transition-colors duration-300`}>
              <input type="checkbox" name="includeRoads"
                    checked={featureSettings.includeRoads}
                    onChange={(e) => handleUpdateSetting(e.target.name, e.target.checked)}
                    className={`w-4 h-4 rounded ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'} text-blue-600 focus:ring-blue-500 transition-colors duration-300`}
                    disabled={isGenerating} />
              Road Network
            </label>
          </div>
        </div>
      </div>

      {/* Canvas Section with decorative elements */}
      <div className={`w-full max-w-5xl ${darkMode ? 'bg-gray-800' : 'bg-white'} p-3 rounded-lg shadow-md relative overflow-hidden transition-colors duration-300`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
        
        {isGenerating && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-3"></div>
              <span className="text-white text-xl font-medium">Generating map...</span>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={mapSize.width}
          height={mapSize.height}
          className={`block border ${darkMode ? 'border-gray-700' : 'border-gray-200'} rounded-md shadow-sm w-full transition-colors duration-300`}
          style={{ maxWidth: '100%', height: 'auto' }}
        >
          Your browser does not support the canvas element.
        </canvas>
      </div>

      {/* Footer/Info */}
      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-6 mb-4 text-center max-w-3xl transition-colors duration-300`}>
        This Fantasy Map Generator uses seeded Perlin noise to create unique, reproducible maps.
        <br />Each seed produces a different world with its own geography, settlements, and road networks.
      </p>
    </div>
  );
};

export default FantasyMapGenerator; 