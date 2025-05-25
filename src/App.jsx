import React, { useState } from 'react';
import './App.css';
import MapCanvas from './components/MapCanvas';

function App() {
  const [oceanLevel, setOceanLevel] = useState(0.0);
  const [mountainDensity, setMountainDensity] = useState(0.5);
  const [forestCoverage, setForestCoverage] = useState(0.4);

  const handleOceanLevelChange = (event) => {
    setOceanLevel(parseFloat(event.target.value));
  };

  const handleMountainDensityChange = (event) => {
    setMountainDensity(parseFloat(event.target.value));
  };

  const handleForestCoverageChange = (event) => {
    setForestCoverage(parseFloat(event.target.value));
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gray-800 text-white p-4 text-center">
        <h1 className="text-xl">Fantasy Map Generator</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-4 bg-gray-200 flex justify-center items-center">
          <MapCanvas
            oceanLevel={oceanLevel}
            mountainDensity={mountainDensity}
            forestCoverage={forestCoverage}
          />
        </main>
        <aside className="w-64 bg-gray-100 p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-2">Controls</h2>
          <div>
            <label htmlFor="oceanLevel" className="block mb-1 text-sm">
              Ocean Level: {oceanLevel.toFixed(2)}
            </label>
            <input
              type="range"
              id="oceanLevel"
              min="-0.5"
              max="0.5"
              step="0.01"
              value={oceanLevel}
              onChange={handleOceanLevelChange}
              className="w-full"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="mountainDensity" className="block mb-1 text-sm">
              Mountain Density: {mountainDensity.toFixed(2)}
            </label>
            <input
              type="range"
              id="mountainDensity"
              min="0"
              max="1"
              step="0.01"
              value={mountainDensity}
              onChange={handleMountainDensityChange}
              className="w-full"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="forestCoverage" className="block mb-1 text-sm">
              Forest Coverage: {forestCoverage.toFixed(2)}
            </label>
            <input
              type="range"
              id="forestCoverage"
              min="0"
              max="1"
              step="0.01"
              value={forestCoverage}
              onChange={handleForestCoverageChange}
              className="w-full"
            />
          </div>
          {/* Future controls will go here */}
        </aside>
      </div>
      <footer className="bg-gray-800 text-white p-2 text-center text-sm">
        <p>Seed: <span id="seed-display">N/A</span></p>
      </footer>
    </div>
  );
}

export default App;
