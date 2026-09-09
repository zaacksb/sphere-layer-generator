'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { Download, LayoutDashboard, Settings } from 'lucide-react';

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
  const [diameter, setDiameter] = useState<number>(100);
  const [thickness, setThickness] = useState<number>(3);
  const [holeDiameter, setHoleDiameter] = useState<number>(4);
  const [margin, setMargin] = useState<number>(2);
  const [boardWidth, setBoardWidth] = useState<number>(600);
  const [boardHeight, setBoardHeight] = useState<number>(400);

  // Generate circles
  const circles = useMemo(() => {
    const R = diameter / 2;
    const N = Math.round(diameter / thickness);
    const result: Circle[] = [];
    
    for (let i = 0; i < N; i++) {
      const z = -R + (i + 0.5) * thickness;
      if (Math.abs(z) < R) {
        const r = Math.sqrt(R * R - z * z);
        if (r > (holeDiameter / 2)) {
          result.push({ id: i, layer: i + 1, z, r });
        }
      }
    }
    
    // Sort descending by radius for better packing
    return result.sort((a, b) => b.r - a.r);
  }, [diameter, thickness, holeDiameter]);

  // Pack circles into boards (simple row-based packing with bounding boxes)
  const boards = useMemo(() => {
    const result: Board[] = [];
    let currentBoard: PlacedCircle[] = [];
    
    let currentX = margin;
    let currentY = margin;
    let rowHeight = 0;

    circles.forEach((circle) => {
      const d = circle.r * 2;
      const boundingBoxSize = d + margin;

      // Check if it fits in current row
      if (currentX + boundingBoxSize > boardWidth) {
        // Move to next row
        currentX = margin;
        currentY += rowHeight;
        rowHeight = 0;
      }

      // Check if it fits in current board
      if (currentY + boundingBoxSize > boardHeight) {
        // Move to next board
        result.push({ id: result.length + 1, circles: currentBoard });
        currentBoard = [];
        currentX = margin;
        currentY = margin;
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

  const handleDownload = async () => {
    const zip = new JSZip();

    boards.forEach((board) => {
      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${boardWidth}mm" height="${boardHeight}mm" viewBox="0 0 ${boardWidth} ${boardHeight}">\n`;
      
      board.circles.forEach(c => {
        // Outer cut (e.g., black)
        svgContent += `  <circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${c.r.toFixed(2)}" fill="none" stroke="black" stroke-width="0.5" />\n`;
        // Inner hole cut (e.g., red)
        if (holeDiameter > 0) {
          svgContent += `  <circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${(holeDiameter/2).toFixed(2)}" fill="none" stroke="red" stroke-width="0.5" />\n`;
        }
        // Optional: Label for layer number (could be engraved)
        // svgContent += `  <text x="${c.x.toFixed(2)}" y="${c.y.toFixed(2)}" font-size="5" text-anchor="middle" fill="blue">${c.layer}</text>\n`;
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
                onChange={(e) => setDiameter(Number(e.target.value))}
                className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                min={10}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Espessura do Material (t) [mm]</label>
              <input
                type="number"
                value={thickness}
                onChange={(e) => setThickness(Number(e.target.value))}
                className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                min={0.1}
                step={0.1}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Furo Central [mm]</label>
              <input
                type="number"
                value={holeDiameter}
                onChange={(e) => setHoleDiameter(Number(e.target.value))}
                className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                min={0}
                step={0.1}
              />
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
                  onChange={(e) => setBoardWidth(Number(e.target.value))}
                  className="w-full border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow"
                  min={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Altura [mm]</label>
                <input
                  type="number"
                  value={boardHeight}
                  onChange={(e) => setBoardHeight(Number(e.target.value))}
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
                onChange={(e) => setMargin(Number(e.target.value))}
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
      <div className="flex-1 bg-neutral-100 p-8 overflow-y-auto relative">
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
          {boards.map((board) => (
            <div key={board.id} className="space-y-2">
              <div className="flex justify-between items-center text-sm font-medium text-neutral-500">
                <span>Chapa {board.id}</span>
                <span>{boardWidth}x{boardHeight}mm</span>
              </div>
              <div 
                className="bg-white shadow-sm border border-neutral-200 rounded-sm relative overflow-hidden"
                style={{ 
                  aspectRatio: `${boardWidth} / ${boardHeight}`,
                  width: '100%',
                  maxWidth: '100%'
                }}
              >
                <svg
                  viewBox={`0 0 ${boardWidth} ${boardHeight}`}
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
                        strokeWidth={boardWidth / 400} 
                      />
                      {/* Inner hole */}
                      {holeDiameter > 0 && (
                        <circle 
                          cx={c.x} 
                          cy={c.y} 
                          r={holeDiameter / 2} 
                          fill="none" 
                          stroke="#ef4444" 
                          strokeWidth={boardWidth / 400} 
                        />
                      )}
                      {/* Layer text */}
                      <text
                        x={c.x}
                        y={c.y}
                        dy="0.3em"
                        fontSize={Math.max(c.r / 3, 2)}
                        textAnchor="middle"
                        fill="#9ca3af"
                        fontFamily="sans-serif"
                      >
                        {c.layer}
                      </text>
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
      </div>
    </div>
  );
}
