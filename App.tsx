import React, { useState } from 'react';
import { Gear, createGearGeometry } from './components/Gear';
import { Configurator } from './components/Configurator';
import { exportGLB } from './components/gltfExporter';

const App: React.FC = () => {
  const [gearParams, setGearParams] = useState({
    innerRadius: 0.5,
    outerRadius: 1.0,
    width: 0.3,
    teeth: 12,
    toothDepth: 0.2,
  });

  const handleParamChange = (param: keyof typeof gearParams, value: number) => {
    if (param === 'innerRadius' && value >= gearParams.outerRadius) {
      return;
    }
    if (param === 'outerRadius' && value <= gearParams.innerRadius) {
      return;
    }
    setGearParams(prev => ({ ...prev, [param]: value }));
  };
  
  const handleDownload = () => {
    const geometry = createGearGeometry(
      gearParams.innerRadius,
      gearParams.outerRadius,
      gearParams.width,
      Math.round(gearParams.teeth),
      gearParams.toothDepth
    );

    const blob = exportGLB(geometry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gear.glb';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f8f5f0] text-gray-800 font-sans p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 lg:gap-12">
        
        {/* Left side: Title and Configurator */}
        <div className="flex-shrink-0 w-full lg:w-96">
          <div className="text-center lg:text-left mb-6">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-2">
              Interactive Gear Modeler
            </h1>
            <p className="text-md text-gray-600">
              A WebGL tool for procedural generation of spur gear geometry.
            </p>
          </div>
          <Configurator params={gearParams} onParamChange={handleParamChange} />
          <div className="mt-6">
            <button
              onClick={handleDownload}
              className="w-full bg-blue-800 text-white font-sans font-bold py-3 px-6 rounded-md hover:bg-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-800/30 transition-colors duration-200"
              aria-label="Download gear as .glb file"
            >
              Export as .glb file
            </button>
          </div>
        </div>

        {/* Right side: WebGL Canvas */}
        <div className="flex-grow flex items-center justify-center w-full lg:w-auto">
          <Gear {...gearParams} />
        </div>

      </div>
    </main>
  );
};

export default App;