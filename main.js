import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Download, RefreshCcw } from 'lucide-react'; // Corrected Refresh icon import

const FantasyMapGenerator = () => {
  const canvasRef = useRef(null);
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000));
  const [mapStyle, setMapStyle] = useState('parchment'); // Options: 'parchment', 'color'
  const [mapSize, setMapSize] = useState({ width: 800, height: 600 });
  const [featureSettings, setFeatureSettings] = useState({
    mountainDensity: 0.5,
    forestDensity: 0.6,
    riverCount: 5,
    cityCount: 7,
    includeRoads: true,
    includeLabels: true,
    oceanDepth: 0.65 // Threshold for water level
  });
  const [isGenerating, setIsGenerating] = useState(false);

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
    setIsGenerating(false); // Generation finished
    return terrainNoise; // Return noise for other features
  };

  // --- Feature Generation Functions (Mountains, Forests, Rivers, Cities, Roads, Labels) ---

  // Generate mountain ranges (Improved visual)
  const generateMountains = (ctx, width, height, terrainNoise, currentSeed) => {
    console.time('generateMountains');
    const { mountainDensity, oceanDepth } = featureSettings;
    // Use seed for ridge noise generation
    const mountainRidgeNoise = generateNoise(width, height, currentSeed + 2, 150, 4, 0.6, 2.1);
    const mountainDetailNoise = generateNoise(width, height, currentSeed + 3, 30, 5, 0.5, 2.0);

    ctx.fillStyle = mapStyle === 'color' ? 'rgba(100, 90, 80, 0.5)' : 'rgba(80, 75, 70, 0.4)'; // Darker, slightly brown shadow
    ctx.strokeStyle = mapStyle === 'color' ? 'rgba(200, 200, 195, 0.6)' : 'rgba(210, 210, 205, 0.5)'; // Highlight color
    ctx.lineWidth = 0.5;

    for (let y = 0; y < height; y += 3) { // Denser check
        for (let x = 0; x < width; x += 3) {
            const i = y * width + x;
            if (!terrainNoise[i]) continue; // Skip if no terrain data (edge case)

            const terrainValue = terrainNoise[i];
            const ridgeValue = mountainRidgeNoise[i];
            const detailValue = mountainDetailNoise[i];

            // Mountains appear on higher terrain, influenced by ridge noise and density setting
            if (terrainValue > oceanDepth + 0.4 && ridgeValue > (0.8 - mountainDensity * 0.4) && terrainValue < 0.95) { // Avoid highest peaks for jagged look
                const baseSize = 3 + Math.floor((terrainValue - (oceanDepth + 0.4)) * 25); // Size based on elevation
                const peakHeight = baseSize * (1.5 + detailValue * 1.5); // Jagged peaks using detail noise
                const angle = detailValue * Math.PI * 2; // Vary angle slightly

                ctx.beginPath();
                ctx.moveTo(x, y);
                // Create a more triangular, slightly irregular shape
                ctx.lineTo(x + baseSize * 0.6 * Math.cos(angle - 0.5), y - peakHeight * Math.sin(angle - 0.5));
                ctx.lineTo(x - baseSize * 0.6 * Math.cos(angle + 0.5), y - peakHeight * Math.sin(angle + 0.5));
                ctx.closePath();

                // Fill with a base mountain color/shadow
                ctx.fillStyle = mapStyle === 'color' ? `rgba(${100 + detailValue * 20}, ${90 + detailValue * 20}, ${80 + detailValue * 20}, 0.6)` : `rgba(80, 75, 70, ${0.3 + detailValue * 0.3})`;
                ctx.fill();

                // Add subtle highlight
                ctx.beginPath();
                 ctx.moveTo(x,y); // Start slightly lower
                 ctx.lineTo(x + baseSize * 0.3 * Math.cos(angle - 0.5), y - peakHeight *0.8 * Math.sin(angle-0.5)); // Shorter highlight line
                ctx.stroke();

            }
             // Add snow caps based on elevation and detail noise
             if (terrainValue > oceanDepth + 0.55 + detailValue * 0.1) {
                ctx.fillStyle = mapStyle === 'color' ? 'rgba(245, 245, 245, 0.8)' : 'rgba(230, 230, 225, 0.7)';
                const snowSize = Math.max(1, baseSize * (terrainValue - (oceanDepth + 0.55)) * 5);
                ctx.beginPath();
                ctx.arc(x, y - peakHeight * 0.7, snowSize, 0, Math.PI * 2); // Place snow near the peak
                ctx.fill();
            }
        }
    }
    console.timeEnd('generateMountains');
  };


    // Generate forests (Improved Visual - Clumps of Trees)
    const generateForests = (ctx, width, height, terrainNoise, currentSeed) => {
        console.time('generateForests');
        const { forestDensity, oceanDepth } = featureSettings;
        // Seeded noise for forest placement
        const forestNoise = generateNoise(width, height, currentSeed + 4, 60, 5, 0.55, 2.1);
        const treeDetailNoise = generateNoise(width, height, currentSeed + 5, 15, 4, 0.6, 2.0); // For individual tree variation

        const forestBaseColor = mapStyle === 'color' ? 'rgba(40, 100, 40, 0.5)' : 'rgba(80, 110, 80, 0.4)'; // Slightly transparent base
        const treeColor = mapStyle === 'color' ? '#3A613A' : '#6A785A'; // Darker green / muted green

        for (let y = 5; y < height - 5; y += 4) { // Check denser grid
            for (let x = 5; x < width - 5; x += 4) {
                const i = y * width + x;
                 if (!terrainNoise[i]) continue;

                const terrainValue = terrainNoise[i];
                const forestValue = forestNoise[i];
                const treeDetail = treeDetailNoise[i];

                // Forests appear on medium terrain elevations, controlled by density
                if (terrainValue > oceanDepth + 0.04 && // Start slightly above sand
                    terrainValue < oceanDepth + 0.45 && // Not too high into mountains
                    forestValue > (0.65 - forestDensity * 0.3)) { // Density threshold

                    // Draw a small cluster of 'trees' instead of just one circle
                    const clumpSize = 2 + Math.floor(forestValue * 5); // Size of the forest patch
                     const numTrees = 2 + Math.floor(treeDetail * 4); // Number of trees in the clump

                    for(let t=0; t < numTrees; t++) {
                        const offsetX = (Math.random() - 0.5) * clumpSize * 1.5;
                        const offsetY = (Math.random() - 0.5) * clumpSize * 1.5;
                        const treeSize = 1.5 + Math.random() * 2.5; // Vary tree size

                        ctx.fillStyle = treeColor;
                        ctx.beginPath();
                        // Simple triangle or circle for trees
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
        console.timeEnd('generateForests');
    };


   // Generate rivers (Improved pathfinding)
    const generateRivers = (ctx, width, height, terrainNoise, currentSeed) => {
        console.time('generateRivers');
        const { riverCount, oceanDepth } = featureSettings;
        const riverColor = mapStyle === 'color' ? 'rgba(65, 105, 170, 0.9)' : 'rgba(150, 140, 110, 0.8)'; // Muted blue/brown for parchment
        ctx.strokeStyle = riverColor;


        // Simple PRNG for river starting points, seeded
        let riverSeed = currentSeed + 6;
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
                startX = Math.floor(randomRiverPoint() * (width * 0.8)) + width * 0.1; // Avoid edges initially
                startY = Math.floor(randomRiverPoint() * (height * 0.8)) + height * 0.1;
                const startIndex = Math.floor(startY) * width + Math.floor(startX);

                if (terrainNoise[startIndex] && terrainNoise[startIndex] > oceanDepth + 0.3 && terrainNoise[startIndex] < oceanDepth + 0.55) { // Start in hills/low mountains
                    // Check if too close to another river start? (Optional improvement)
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
            const maxSteps = 1500; // Prevent infinite loops
            let path = [{x, y}]; // Store path to avoid immediate backtracking (simple)

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

                        const nx = Math.round(x + dx); // Check adjacent pixels
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
                    // Stuck? Maybe try a slightly wider search or terminate
                    break; // End river if no downhill path found
                }


                 // Update position and draw line segment
                 x = nextX;
                 y = nextY;
                 path.push({x, y});
                 currentHeight = lowestHeight;

                // Increase line width slightly as river progresses?
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
        console.timeEnd('generateRivers');
    };


     // Generate cities (Improved Placement Logic)
    const generateCities = (ctx, width, height, terrainNoise, currentSeed) => {
        console.time('generateCities');
        const { cityCount, oceanDepth } = featureSettings;
        const cities = [];
        const minCityDistance = 40; // Minimum distance between cities

        // Use seeded PRNG for city placement attempts
        let citySeed = currentSeed + 7;
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

                // Placement criteria:
                // 1. On land (not water, not too high mountain)
                // 2. Near water or river? (more complex, skip for now)
                // 3. Not too close to other cities

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

        console.timeEnd('generateCities');
        return cities; // Return city locations for roads/labels
    };


   // Generate roads (Basic A* or similar pathfinding - Simplified for now)
    const generateRoads = (ctx, cities, terrainNoise, width, height) => {
        if (!featureSettings.includeRoads || cities.length < 2) return;
        console.time('generateRoads');

        const roadColor = mapStyle === 'color' ? '#B8860B' : '#A0522D'; // DarkGoldenrod / Sienna
        ctx.strokeStyle = roadColor;
        ctx.lineWidth = mapStyle === 'color' ? 1.2 : 1.0; // Thinner on parchment
        ctx.setLineDash([2, 2]); // Dashed line for roads

        // Connect each city to its nearest 1 or 2 neighbors (simple MST-like approach)
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

        // Sort edges by distance (for Kruskal's algorithm idea)
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

                // TODO: Implement pathfinding (e.g., A*) that avoids water/high mountains
                // Simple straight line for now:
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
                // Stop after connecting all cities (Minimum Spanning Tree)
                 // or add a few more connections?
                //if (edgeCount >= cities.length - 1) break; // Minimum connections
            }
             // Optional: Add a few extra short connections for a denser network
            // if (edgeCount < cities.length * 1.2 && edge.dist < width / 5) { ... }
        }


        ctx.setLineDash([]); // Reset line dash
        console.timeEnd('generateRoads');
    };


     // Add map labels (Improved Placement & Style)
    const generateLabels = (ctx, cities, terrainNoise, width, height, currentSeed) => {
        if (!featureSettings.includeLabels) return;
        console.time('generateLabels');

        const { oceanDepth } = featureSettings;

        // Simple seeded PRNG for name selection
        let nameSeed = currentSeed + 8;
        const randomNameIndex = (max) => {
            nameSeed = (nameSeed * 9301 + 49297) % 233280;
            return Math.floor((nameSeed / 233280.0) * max);
        };


        // Expanded list of fantasy names
        const cityNames = [
            "Silverhaven", "Ironwood", "Stormcliff", "Moonbright", "Shadowfen", "Goldcrest",
            "Riverbend", "Oakhaven", "Dragonspyre", "Frostford", "Sunstone", "Mistvale",
            "Stonebridge", "Windhelm", "Deepwood", "Starfall", "Winterpeak", "Emberglow",
             "Whisperwind", "Ravenrock", "Clearwater", "Barrowdown", "Greyfang", "Seacliff"
        ];

        const regionNames = [
            "The Whispering Plains", "Mountains of Echoes", "Emerald Forest", "Sea of Lost Souls",
            "Frozen Expanse", "Sunken Kingdom", "Dragon's Tooth Peaks", "The Twilight Marsh",
            "Crystal Canyons", "Fields of Renewal", "The Jagged Coast", "Vale of Ancients",
             "Barren Wastes", "Shadowlands", "Isles of Mist"
        ];

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const labelColor = mapStyle === 'color' ? "#1A1A1A" : "#4A3A2A"; // Very dark grey / Dark brown
        const outlineColor = mapStyle === 'color' ? "rgba(255, 255, 255, 0.7)" : "rgba(235, 225, 200, 0.6)"; // Semi-transparent white/parchment

        // --- Label Cities ---
        ctx.font = mapStyle === 'color' ? "bold 11px sans-serif" : "bold 11px serif"; // Sans-serif for color, serif for parchment
        const usedCityNames = new Set();
        cities.forEach((city) => {
            let name;
            let nameAttempts = 0;
            do {
                name = cityNames[randomNameIndex(cityNames.length)];
                nameAttempts++;
            } while (usedCityNames.has(name) && nameAttempts < cityNames.length * 2); // Prevent infinite loop if few names

            if (!usedCityNames.has(name)){
                usedCityNames.add(name);

                const textX = city.x;
                const textY = city.y + 14; // Place slightly below city marker

                // Draw outline for better readability
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = 2.5;
                ctx.strokeText(name, textX, textY);

                // Draw main text
                ctx.fillStyle = labelColor;
                ctx.fillText(name, textX, textY);
            }
        });

        // --- Add Region Names ---
        ctx.font = mapStyle === 'color' ? "italic bold 16px sans-serif" : "italic bold 16px serif";
        const usedRegionNames = new Set();
        const numRegions = 4 + randomNameIndex(3); // 4 to 6 regions

        for (let i = 0; i < numRegions; i++) {
            let x, y, attempts = 0;
            let suitable = false;
            let regionType = 'land'; // Default

            // Try to find a good spot for the region label
            while (!suitable && attempts < 50) {
                x = Math.floor(randomNameIndex(1) * (width - 200)) + 100; // Avoid edges
                y = Math.floor(randomNameIndex(1) * (height - 100)) + 50;
                const terrainIndex = Math.floor(y) * width + Math.floor(x);

                if (terrainNoise[terrainIndex]) {
                     // Basic check: is it mostly over land, water, or mountains nearby?
                     // (A more robust check would average terrain height in a radius)
                     const terrainVal = terrainNoise[terrainIndex];
                     if (terrainVal < oceanDepth - 0.05) regionType = 'water';
                     else if (terrainVal > oceanDepth + 0.5) regionType = 'mountain';
                     else regionType = 'land';

                    // TODO: Check for overlap with city labels or other region labels?
                    suitable = true; // Simple placement for now
                }
                attempts++;
            }

            if (suitable) {
                 let name;
                 let nameAttempts = 0;
                 do {
                     name = regionNames[randomNameIndex(regionNames.length)];
                     // Optional: Match region name type to terrain type? (e.g., watery names for sea regions)
                     nameAttempts++;
                 } while (usedRegionNames.has(name) && nameAttempts < regionNames.length * 2);

                 if(!usedRegionNames.has(name)) {
                    usedRegionNames.add(name);

                    // Draw outline
                    ctx.strokeStyle = outlineColor;
                    ctx.lineWidth = 4;
                    ctx.strokeText(name, x, y);

                    // Draw text
                    ctx.fillStyle = labelColor;
                    ctx.fillText(name, x, y);
                 }
            }
        }
         console.timeEnd('generateLabels');
    };


    // Apply parchment texture and border
    const applyPostprocessing = (ctx, width, height, currentSeed) => {
        console.time('applyPostprocessing');
        if (mapStyle === 'parchment') {
            // 1. Parchment Color Overlay
            ctx.fillStyle = 'rgba(227, 217, 187, 0.25)'; // Semi-transparent parchment color
            ctx.fillRect(0, 0, width, height);

            // 2. Subtle Noise Texture
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const noiseStrength = 15; // Adjust for desired texture intensity
             // Seeded PRNG for noise pattern
            let noiseSeed = currentSeed + 9;
            const randomNoise = () => {
                 noiseSeed = (noiseSeed * 9301 + 49297) % 233280;
                return (noiseSeed / 233280.0 - 0.5) * noiseStrength; // Centered noise
            };


            for (let i = 0; i < data.length; i += 4) {
                const noise = randomNoise();
                data[i] = Math.min(255, Math.max(0, data[i] + noise));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
                // Keep alpha as is: data[i + 3]
            }
            ctx.putImageData(imageData, 0, 0);

            // 3. Darker Border
            ctx.strokeStyle = '#7A6A5A'; // Darker, less saturated brown
            ctx.lineWidth = 12;
            ctx.strokeRect(6, 6, width - 12, height - 12); // Inset border

            // 4. Inner vignette/edge darkening (Optional)
            const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)'); // Subtle darkening towards edges
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

        } else if (mapStyle === 'color') {
             // Optional: Add a simple border for color maps too
             ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
             ctx.lineWidth = 4;
             ctx.strokeRect(2, 2, width - 4, height - 4);
        }
        console.timeEnd('applyPostprocessing');
    };


  // --- Main Map Generation Function ---
  const generateMap = () => {
    console.log(`Generating map with seed: ${seed}, style: ${mapStyle}`);
    console.time('generateMapTotal');
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = mapSize;

    // Ensure canvas dimensions are set
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
     ctx.fillStyle = mapStyle === 'parchment' ? '#E3D9BB' : '#4169E1'; // Parchment base or Royal Blue ocean base
     ctx.fillRect(0, 0, width, height);


    // Use a local variable for the seed for this generation run
    const currentSeed = seed;

    // Generate base terrain (returns noise data)
    // Wrap terrain generation in a Promise or use async/await if it becomes very long
    // For now, it runs synchronously but updates the 'isGenerating' state
     const terrainNoise = generateTerrain(ctx, width, height, currentSeed);


    // Add features - Pass the *same* currentSeed to maintain consistency
    generateMountains(ctx, width, height, terrainNoise, currentSeed);
    generateForests(ctx, width, height, terrainNoise, currentSeed);
    generateRivers(ctx, width, height, terrainNoise, currentSeed);
    const cities = generateCities(ctx, width, height, terrainNoise, currentSeed);

    // Add civilization elements
    generateRoads(ctx, cities, terrainNoise, width, height); // Needs cities
    generateLabels(ctx, cities, terrainNoise, width, height, currentSeed); // Needs cities

    // Apply final styling/post-processing
    applyPostprocessing(ctx, width, height, currentSeed);

    console.timeEnd('generateMapTotal');
  };

  // --- Event Handlers ---

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `fantasy-map-${mapStyle}-${seed}.png`;
    link.href = canvas.toDataURL('image/png'); // Get data URL
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up
     console.log("Map download initiated.");
  };

  const handleRegenerateMap = () => {
     console.log("Regenerating map with new seed...");
    setSeed(Math.floor(Math.random() * 1000000)); // Generate new seed triggers useEffect
  };

  const handleUpdateSetting = (setting, value) => {
     // Ensure numeric values from sliders/inputs are treated as numbers
    const numericSettings = ['mountainDensity', 'forestDensity', 'riverCount', 'cityCount', 'oceanDepth'];
    const processedValue = numericSettings.includes(setting) ? Number(value) : value;

     console.log(`Updating setting: ${setting} to ${processedValue}`);
    setFeatureSettings(prev => ({
      ...prev,
      [setting]: processedValue // Use processed value
    }));
     // No need to call generateMap here, useEffect handles it
  };

    const handleChangeMapStyle = (style) => {
        console.log(`Changing map style to: ${style}`);
        setMapStyle(style);
         // No need to call generateMap here, useEffect handles it
    };

   // --- useEffect Hook ---
   // Regenerate map when seed, style, or settings change
    useEffect(() => {
        // Debounce or throttle generateMap if settings change rapidly?
        // Simple approach: generate whenever relevant state changes.
        generateMap();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seed, mapStyle, featureSettings, mapSize]); // Include mapSize if it becomes dynamic

  // --- JSX ---
  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">Fantasy Map Generator</h1>

        {/* Controls Section */}
        <div className="w-full max-w-4xl bg-white p-4 rounded shadow mb-4 flex flex-wrap gap-4 justify-between items-start">

           {/* Left Side Controls: Generation & Style */}
           <div className="flex flex-col gap-3">
                {/* Seed & Regenerate */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRegenerateMap}
                        className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-150 flex items-center gap-1 disabled:opacity-50"
                        title="Generate New Map (Random Seed)"
                        disabled={isGenerating}
                    >
                        <RefreshCcw size={18} />
                        Regenerate
                    </button>
                    <span className="text-sm text-gray-600">Seed: {seed}</span>
                </div>

                {/* Map Style */}
                <div className="flex flex-col">
                     <label className="block text-sm font-medium text-gray-700 mb-1">Map Style:</label>
                     <div className="flex gap-3">
                        <button
                            onClick={() => handleChangeMapStyle('parchment')}
                            className={`px-3 py-1 text-sm rounded ${mapStyle === 'parchment' ? 'bg-amber-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                            disabled={isGenerating}
                        >
                            Parchment
                        </button>
                         <button
                            onClick={() => handleChangeMapStyle('color')}
                            className={`px-3 py-1 text-sm rounded ${mapStyle === 'color' ? 'bg-teal-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                            disabled={isGenerating}
                        >
                            Color
                        </button>
                     </div>
                </div>

                {/* Download Button */}
                 <button
                    onClick={handleDownload}
                    className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition duration-150 flex items-center gap-1 disabled:opacity-50"
                     disabled={isGenerating}
                     title="Download Map as PNG"
                 >
                    <Download size={18} />
                    Download Map
                </button>
           </div>

            {/* Right Side Controls: Feature Settings */}
            <div className="flex flex-col gap-3 flex-grow" style={{minWidth: '250px'}}>
                <h2 className="text-lg font-semibold text-gray-700 mb-1">Features</h2>

                {/* Sliders */}
                 <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <label htmlFor="oceanDepth" className="text-sm text-gray-600 self-center">Ocean Level:</label>
                    <input type="range" id="oceanDepth" name="oceanDepth" min="0.3" max="0.8" step="0.01"
                           value={featureSettings.oceanDepth}
                           onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                           className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 self-center"
                           disabled={isGenerating} />

                    <label htmlFor="mountainDensity" className="text-sm text-gray-600 self-center">Mountains:</label>
                    <input type="range" id="mountainDensity" name="mountainDensity" min="0" max="1" step="0.05"
                           value={featureSettings.mountainDensity}
                           onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                           className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 self-center"
                            disabled={isGenerating} />

                    <label htmlFor="forestDensity" className="text-sm text-gray-600 self-center">Forests:</label>
                    <input type="range" id="forestDensity" name="forestDensity" min="0" max="1" step="0.05"
                           value={featureSettings.forestDensity}
                           onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                           className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 self-center"
                            disabled={isGenerating} />

                     <label htmlFor="riverCount" className="text-sm text-gray-600 self-center">Rivers:</label>
                    <input type="range" id="riverCount" name="riverCount" min="0" max="15" step="1"
                           value={featureSettings.riverCount}
                           onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                           className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 self-center"
                            disabled={isGenerating} />

                      <label htmlFor="cityCount" className="text-sm text-gray-600 self-center">Cities:</label>
                    <input type="range" id="cityCount" name="cityCount" min="0" max="20" step="1"
                           value={featureSettings.cityCount}
                           onChange={(e) => handleUpdateSetting(e.target.name, e.target.value)}
                           className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 self-center"
                            disabled={isGenerating} />
                 </div>

                {/* Checkboxes */}
                 <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-1 text-sm text-gray-600">
                        <input type="checkbox" name="includeLabels"
                               checked={featureSettings.includeLabels}
                               onChange={(e) => handleUpdateSetting(e.target.name, e.target.checked)}
                               className="rounded text-blue-500 focus:ring-blue-400"
                                disabled={isGenerating} />
                        Labels
                    </label>
                    <label className="flex items-center gap-1 text-sm text-gray-600">
                        <input type="checkbox" name="includeRoads"
                               checked={featureSettings.includeRoads}
                               onChange={(e) => handleUpdateSetting(e.target.name, e.target.checked)}
                               className="rounded text-blue-500 focus:ring-blue-400"
                                disabled={isGenerating} />
                        Roads
                    </label>
                 </div>
            </div>
        </div>

        {/* Canvas Section */}
        <div className="w-full max-w-4xl bg-white p-1 rounded shadow relative">
            {isGenerating && (
                 <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                    <span className="text-white text-xl">Generating...</span>
                 </div>
            )}
            <canvas
                ref={canvasRef}
                width={mapSize.width}
                height={mapSize.height}
                className="block border border-gray-300 rounded" // Added border for visibility
                style={{ maxWidth: '100%', height: 'auto' }} // Responsive canvas sizing
            >
                Your browser does not support the canvas element.
            </canvas>
        </div>

         {/* Footer/Info */}
         <p className="text-xs text-gray-500 mt-4">
             Map generation uses seeded Perlin noise. Different seeds produce different maps.
         </p>

    </div>
  );
};

export default FantasyMapGenerator;