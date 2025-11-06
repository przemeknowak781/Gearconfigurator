import React from 'react';

interface GearParams {
  innerRadius: number;
  outerRadius: number;
  width: number;
  teeth: number;
  toothDepth: number;
}

interface ConfiguratorProps {
  params: GearParams;
  onParamChange: (param: keyof GearParams, value: number) => void;
}

interface SliderProps {
  label: string;
  param: keyof GearParams;
  min: number;
  max: number;
  step: number;
  value: number;
  onParamChange: (param: keyof GearParams, value: number) => void;
  isInteger?: boolean;
}

const Slider: React.FC<SliderProps> = ({ label, param, min, max, step, value, onParamChange, isInteger = false }) => (
  <div className="flex flex-col space-y-2">
    <div className="flex justify-between items-center">
      <label htmlFor={param} className="font-medium text-gray-300 select-none">{label}</label>
      <span className="text-sm font-mono bg-gray-700 text-amber-300 px-2 py-1 rounded">
        {isInteger ? value.toFixed(0) : value.toFixed(2)}
      </span>
    </div>
    <input
      id={param}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onParamChange(param, parseFloat(e.target.value))}
      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
      aria-label={label}
    />
  </div>
);

export const Configurator: React.FC<ConfiguratorProps> = ({ params, onParamChange }) => {
  return (
    <div className="w-full p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 space-y-6 shadow-2xl shadow-blue-500/10">
      <Slider label="Inner Radius" param="innerRadius" min={0.1} max={params.outerRadius - 0.1} step={0.05} value={params.innerRadius} onParamChange={onParamChange} />
      <Slider label="Outer Radius" param="outerRadius" min={params.innerRadius + 0.1} max={2.0} step={0.05} value={params.outerRadius} onParamChange={onParamChange} />
      <Slider label="Width" param="width" min={0.1} max={1.0} step={0.05} value={params.width} onParamChange={onParamChange} />
      <Slider label="Teeth" param="teeth" min={3} max={40} step={1} value={params.teeth} onParamChange={onParamChange} isInteger />
      <Slider label="Tooth Depth" param="toothDepth" min={0.05} max={0.5} step={0.01} value={params.toothDepth} onParamChange={onParamChange} />
    </div>
  );
};
