'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { Download, LayoutDashboard, Settings, Layers, SquareSlash } from 'lucide-react';

interface Circle {
  id: number;
  r: number;
  layer: number;
  z: number;
}

interface PlacedCircle extends Circle {
  x: number;
  y: number;
}

interface Board {
  id: number;
  circles: PlacedCircle[];
}

export default function SphereGenerator() {
  const [previewMode, setPreviewMode] = useState<'profile' | 'boards'>('profile');
  
  const [diameter, setDiameter] = useState<number | string>(100);
  const [thickness, setThickness] = useState<number | string>(3);
  const [layersCount, setLayersCount] = useState<number | string>(33);
  const [isAutoLayers, setIsAutoLayers] = useState<boolean>(true);
  const [holeDiameter, setHoleDiameter] = useState<number | string>(4);
  const [includeLabels, setIncludeLabels] = useState<boolean>(true);
  const [labelPosition, setLabelPosition] = useState<'center' | 'top' | 'bottom' | 'left' | 'right'>('top');
  const [margin, setMargin] = useState<number | string>(2);
  const [boardWidth, setBoardWidth] = useState<number | string>(600);
  const [boardHeight, setBoardHeight] = useState<number | string>(400);

  const handleDiameterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDiameter(val);
    if (isAutoLayers && Number(val) && Number(thickness)) {
      setLayersCount(Math.round(Number(val) / Number(thickness)));
    }
  };

  const handleThicknessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setThickness(val);
    if (isAutoLayers && Number(diameter) && Number(val)) {
      setLayersCount(Math.round(Number(diameter) / Number(val)));
    }
  };

  const handleLayersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLayersCount(e.target.value);
    setIsAutoLayers(false);
  };

  // Generate circles
  const circles = useMemo(() => {
    const numDiameter = Number(diameter);
    const numThickness = Number(thickness);
    const numHole = Number(holeDiameter);
    const N = Number(layersCount);

    if (!numDiameter || !numThickness || numThickness <= 0 || !N || N <= 0) return [];
    if (N > 5000) return []; // Previne travamentos com inputs inválidos

    const R = numDiameter / 2;
    const totalHeight = N * numThickness;
    const result: Circle[] = [];
    
    for (let i = 0; i < N; i++) {
      // Centraliza as N camadas ao redor de z = 0
      const z = -totalHeight / 2 + (i + 0.5) * numThickness;
      // Se a camada estiver dentro dos limites da esfera teórica
      if (Math.abs(z) < R) {
        const r = Math.sqrt(R * R - z * z);
        if (r > (numHole / 2)) {
          result.push({ id: i, layer: i + 1, z, r });
        }
      }
    }
    
    // Sort descending by radius for better packing
    return result.sort((a, b) => b.r - a.r);
  }, [diameter, thickness, layersCount, holeDiameter]);

  // Pack circles into boards (simple row-based packing with bounding boxes)
  const boards = useMemo(() => {
    const numBoardWidth = Number(boardWidth) || 600;
    const numBoardHeight = Number(boardHeight) || 400;
    const numMargin = Number(margin) || 0;

    const result: Board[] = [];
    let currentBoard: PlacedCircle[] = [];
    
    let currentX = numMargin;
    let currentY = numMargin;
    let rowHeight = 0;

    circles.forEach((circle) => {
      const d = circle.r * 2;
      const boundingBoxSize = d + numMargin;

      // Check if it fits in current row
      if (currentX + boundingBoxSize > numBoardWidth) {
        // Move to next row
        currentX = numMargin;
        currentY += rowHeight;
        rowHeight = 0;
      }

      // Check if it fits in current board
      if (currentY + boundingBoxSize > numBoardHeight) {
        // Move to next board
        result.push({ id: result.length + 1, circles: currentBoard });
        currentBoard = [];
        currentX = numMargin;
        currentY = numMargin;
        rowHeight = 0;
      }

      // Place circle
      currentBoard.push({
        ...circle,
        x: currentX + circle.r,
        y: currentY + circle.r,
      });

      currentX += boundingBoxSize;
      if (boundingBoxSize > rowHeight) {
        rowHeight = boundingBoxSize;
      }
    });

    if (currentBoard.length > 0) {
      result.push({ id: result.length + 1, circles: currentBoard });
    }

    return result;
  }, [circles, boardWidth, boardHeight, margin]);

  const getLabelProps = (c: PlacedCircle, holeDiam: number, pos: string) => {
    const hr = holeDiam / 2;
    let lx = c.x;
    let ly = c.y;
    // O espaço livre é entre o furo e a borda. Vamos centralizar o texto nesse espaço.
    // A distância do centro até o meio desse espaço é r_furo + (r_total - r_furo) / 2
    const midDist = hr + (c.r - hr) / 2;
    
    // Calcula um tamanho de fonte que caiba no anel
    const availableSpace = c.r - hr;
    let fontSize = Math.max(Math.min(c.r / 3, availableSpace * 0.5), 1.5);
    
    // Se a peça for menor que o furo (não deve acontecer mas previne), centraliza e reduz a fonte
    if (c.r <= hr) {
      pos = 'center';
      fontSize = Math.max(c.r / 3, 2);
    }
    
    // Se estiver no centro, o tamanho pode ser diferente (o furo vai cortar de qualquer forma)
    if (pos === 'center') {
      fontSize = Math.max(c.r / 3, 2);
    }

    switch(pos) {
      case 'top': ly = c.y - midDist; break;
      case 'bottom': ly = c.y + midDist; break;
      case 'left': lx = c.x - midDist; break;
      case 'right': lx = c.x + midDist; break;
      case 'center': default: break;
    }

    return { lx, ly, fontSize };
  };

  const handleDownload = async () => {
    const numBoardWidth = Number(boardWidth) || 600;
    const numBoardHeight = Number(boardHeight) || 400;
    const numHole = Number(holeDiameter) || 0;

    const zip = new JSZip();

    boards.forEach((board) => {
      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${numBoardWidth}mm" height="${numBoardHeight}mm" viewBox="0 0 ${numBoardWidth} ${numBoardHeight}">\n`;
      
      board.circles.forEach(c => {
        // Outer cut (e.g., black)
        svgContent += `  <circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${c.r.toFixed(2)}" fill="none" stroke="black" stroke-width="0.5" />\n`;
        // Inner hole cut (e.g., red)
        if (numHole > 0) {
          svgContent += `  <circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${(numHole/2).toFixed(2)}" fill="none" stroke="red" stroke-width="0.5" />\n`;
        }
        // Optional: Label for layer number (could be engraved)
        if (includeLabels) {
          const { lx, ly, fontSize } = getLabelProps(c, numHole, labelPosition);
          svgContent += `  <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" font-size="${fontSize.toFixed(2)}" text-anchor="middle" fill="blue" dominant-baseline="central">${c.layer}</text>\n`;
        }
      });

      svgContent += `</svg>`;
      zip.file(`board_${board.id}.svg`, svgContent);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sphere_${diameter}mm_${thickness}mm_layers.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-neutral-50 text-neutral-900">
      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-white border-r border-neutral-200 p-6 flex flex-col h-full overflow-y-auto shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-neutral-900 p-2 rounded-lg text-white">
            <LayoutDashboard size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Sphere Slicer</h1>
        </div>

        <div className="space-y-6 flex-grow">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-2">
              <Settings size={16} /> Parâmetros da Esfera
            </h2>

            <div>
              <label className="block text-sm font-medium mb-1">Diâmetro Total (D) [mm]</label>
              <input
                type="number"
                value={diameter}
                onChange={handleDiameterChange}
                className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                min={10}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Espessura do Material (t) [mm]</label>
              <input
                type="number"
                value={thickness}
                onChange={handleThicknessChange}
                className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                min={0.1}
                step={0.1}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium">Qtd. de Camadas (N)</label>
                <button 
                  onClick={() => {
                    setIsAutoLayers(true);
                    if (Number(diameter) && Number(thickness)) {
                      setLayersCount(Math.round(Number(diameter) / Number(thickness)));
                    }
                  }}
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors ${isAutoLayers ? 'bg-sky-100 text-sky-700 font-bold' : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300 font-medium'}`}
                  title="Calcular automaticamente para preencher a esfera"
                >
                  {isAutoLayers ? 'Auto' : 'Forçar Auto'}
                </button>
              </div>
              <input
                type="number"
                value={layersCount}
                onChange={handleLayersChange}
                className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                min={1}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Furo Central [mm]</label>
              <input
                type="number"
                value={holeDiameter}
                onChange={(e) => setHoleDiameter(e.target.value)}
                className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                min={0}
                step={0.1}
              />
            </div>
            
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeLabels"
                  checked={includeLabels}
                  onChange={(e) => setIncludeLabels(e.target.checked)}
                  className="w-4 h-4 text-neutral-900 focus:ring-neutral-900 border-neutral-300 rounded"
                />
                <label htmlFor="includeLabels" className="text-sm font-medium select-none cursor-pointer">
                  Gravar números nas peças
                </label>
              </div>
              
              {includeLabels && (
                <div className="pl-6 mt-1">
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Posição do Número</label>
                  <select
                    value={labelPosition}
                    onChange={(e) => setLabelPosition(e.target.value as any)}
                    className="w-full border border-neutral-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                  >
                    <option value="top">Acima do Furo (Recomendado)</option>
                    <option value="bottom">Abaixo do Furo</option>
                    <option value="left">À Esquerda do Furo</option>
                    <option value="right">À Direita do Furo</option>
                    <option value="center">No Centro (Atenção: será cortado pelo furo)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-200">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Configuração da Chapa</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Largura [mm]</label>
                <input
                  type="number"
                  value={boardWidth}
                  onChange={(e) => setBoardWidth(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                  min={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Altura [mm]</label>
                <input
                  type="number"
                  value={boardHeight}
                  onChange={(e) => setBoardHeight(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                  min={100}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Margem entre peças [mm]</label>
              <input
                type="number"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                min={0}
                step={0.5}
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-200 mt-6">
          <div className="flex justify-between text-sm text-neutral-600 mb-4">
            <span>Total de Camadas:</span>
            <span className="font-medium text-neutral-900">{circles.length}</span>
          </div>
          <div className="flex justify-between text-sm text-neutral-600 mb-6">
            <span>Chapas Necessárias:</span>
            <span className="font-medium text-neutral-900">{boards.length}</span>
          </div>
          <button
            onClick={handleDownload}
            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium py-3 px-4 rounded-md flex items-center justify-center gap-2 transition-colors focus:ring-4 focus:ring-neutral-200 outline-none"
          >
            <Download size={18} /> Baixar SVGs (.zip)
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-neutral-100 p-8 overflow-y-auto relative flex flex-col">
        {/* Top Tabs */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-neutral-200/50 p-1 rounded-lg backdrop-blur-sm">
            <button
              onClick={() => setPreviewMode('profile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                previewMode === 'profile' 
                  ? 'bg-white text-neutral-900 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Layers size={16} />
              Visão Lateral (Perfil)
            </button>
            <button
              onClick={() => setPreviewMode('boards')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                previewMode === 'boards' 
                  ? 'bg-white text-neutral-900 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <SquareSlash size={16} />
              Chapas (Corte 2D)
            </button>
          </div>
        </div>

        {previewMode === 'profile' ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl bg-slate-900 rounded-2xl p-8 shadow-xl flex flex-col items-center">
              <div className="w-full max-w-md aspect-square relative flex items-center justify-center">
                <svg 
                  viewBox={`-${Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) * 0.75} -${Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) * 0.75} ${Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) * 1.5} ${Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) * 1.5}`} 
                  className="w-full h-full overflow-visible"
                >
                  {/* Dashed background circle */}
                  <circle 
                    cx="0" 
                    cy="0" 
                    r={(Number(diameter) || 100) / 2} 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth={Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) / 200 || 0.5} 
                    strokeDasharray={`${Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) / 40} ${Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) / 30}`} 
                    opacity="0.3" 
                  />
                  
                  {/* Central axis */}
                  <line 
                    x1="0" 
                    y1={-Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) * 0.6} 
                    x2="0" 
                    y2={Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) * 0.6} 
                    stroke="#3b82f6" 
                    strokeWidth={Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) / 400 || 0.2} 
                    opacity="0.4" 
                    strokeDasharray={`${Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) / 50} ${Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) / 40}`} 
                  />

                  {/* Slices */}
                  {circles.map(c => (
                    <rect 
                       key={c.id}
                       x={-c.r}
                       y={c.z - (Number(thickness) || 0) / 2}
                       width={c.r * 2}
                       height={Number(thickness) || 0}
                       fill="#0284c7"
                       fillOpacity="0.8"
                       stroke="#0ea5e9"
                       strokeWidth={Math.max(Number(diameter) || 100, (Number(layersCount) || 0) * (Number(thickness) || 0)) / 400 || 0.2}
                    />
                  ))}
                </svg>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-12 w-full">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center backdrop-blur-sm">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Camadas Geradas</div>
                  <div className="text-3xl font-bold text-sky-400">{circles.length}</div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center backdrop-blur-sm">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Altura por Fatia</div>
                  <div className="text-3xl font-bold text-sky-400">{Number(thickness || 0).toFixed(2)} <span className="text-lg text-sky-400/70">mm</span></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-8 pb-12 w-full">
            {boards.map((board) => (
              <div key={board.id} className="space-y-2">
                <div className="flex justify-between items-center text-sm font-medium text-neutral-500">
                  <span>Chapa {board.id}</span>
                  <span>{Number(boardWidth) || 600}x{Number(boardHeight) || 400}mm</span>
                </div>
                <div 
                  className="bg-white shadow-sm border border-neutral-200 rounded-sm relative overflow-hidden"
                  style={{ 
                    aspectRatio: `${Number(boardWidth) || 600} / ${Number(boardHeight) || 400}`,
                    width: '100%',
                    maxWidth: '100%'
                  }}
                >
                  <svg
                    viewBox={`0 0 ${Number(boardWidth) || 600} ${Number(boardHeight) || 400}`}
                    className="w-full h-full text-neutral-900"
                    style={{ display: 'block' }}
                  >
                    {board.circles.map(c => (
                      <g key={c.id}>
                        {/* Outer circle */}
                        <circle 
                          cx={c.x} 
                          cy={c.y} 
                          r={c.r} 
                          fill="rgba(0,0,0,0.02)" 
                          stroke="currentColor" 
                          strokeWidth={(Number(boardWidth) || 600) / 400} 
                        />
                        {/* Inner hole */}
                        {Number(holeDiameter) > 0 && (
                          <circle 
                            cx={c.x} 
                            cy={c.y} 
                            r={Number(holeDiameter) / 2} 
                            fill="none" 
                            stroke="#ef4444" 
                            strokeWidth={(Number(boardWidth) || 600) / 400} 
                          />
                        )}
                        {/* Layer text */}
                        {includeLabels && (() => {
                          const { lx, ly, fontSize } = getLabelProps(c, Number(holeDiameter) || 0, labelPosition);
                          return (
                            <text
                              x={lx}
                              y={ly}
                              dy="0.3em" // Ajuste para centralizar visualmente junto ao dominant-baseline central não suportado em todos os viewBoxes de SVG html 
                              fontSize={fontSize}
                              textAnchor="middle"
                              fill="#9ca3af"
                              fontFamily="sans-serif"
                            >
                              {c.layer}
                            </text>
                          );
                        })()}
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            ))}
            {boards.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-neutral-400">
                <p>Nenhuma peça gerada.</p>
                <p className="text-sm">Verifique os parâmetros.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
